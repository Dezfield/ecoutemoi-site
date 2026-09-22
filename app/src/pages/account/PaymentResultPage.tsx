import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { billingErrorMessage, loadBillingStatus, tierLabel } from '../../account/billing';
import type { BillingStatus, PaymentState } from '../../account/types';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { Spinner } from '../../components/Spinner';
import { formatDate } from '../../lib/format';

/**
 * The page a payer lands on after the payment provider sends them back.
 *
 * Landing here proves nothing. Anyone can open this URL, and the provider
 * redirects the browser before its notification has been processed. So the
 * page asks the backend what the account actually has and says nothing more
 * than that. While a payment is still being confirmed it retries a bounded
 * number of times with a growing delay, then stops and offers a manual check
 * instead of polling forever.
 */
const ATTEMPT_DELAYS_MS = [2_000, 3_000, 5_000, 8_000, 12_000];

export function PaymentResultPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [state, setState] = useState<PaymentState>('processing');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const next = await loadBillingStatus();
      setStatus(next);
      setError(null);
      if (next.active) {
        setState('success');
        return true;
      }
      setState(next.paymentPending ? 'processing' : 'failed');
      return !next.paymentPending;
    } catch (loadError) {
      setError(billingErrorMessage(loadError));
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settled = await check();
      if (cancelled || settled || attempt >= ATTEMPT_DELAYS_MS.length) return;
      timerRef.current = setTimeout(() => {
        if (!cancelled) setAttempt((value) => value + 1);
      }, ATTEMPT_DELAYS_MS[attempt]);
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [attempt, check]);

  const exhausted = attempt >= ATTEMPT_DELAYS_MS.length;

  return (
    <>
      <PageHeader eyebrow="Оплата" title="Результат оплаты">
        <p>Статус подписки приходит с сервера Écoute Moi после подтверждения платежа банком.</p>
      </PageHeader>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {state === 'success' && status ? (
        <section className="panel plan-panel plan-panel-active" aria-live="polite">
          <p className="eyebrow">Готово</p>
          <h2 className="plan-name">{tierLabel(status.tier)} активен</h2>
          <p className="panel-text">
            {status.unlimited
              ? 'Бессрочный статус.'
              : status.expiresAt
                ? `Действует до ${formatDate(status.expiresAt)}`
                : 'Подписка активна.'}
          </p>
          <p className="panel-text">
            Подписка уже действует и в приложении Écoute Moi на этом же аккаунте — откройте приложение,
            ничего восстанавливать не нужно.
          </p>
          <Link className="button button-secondary" to="/account/subscription">К подписке</Link>
        </section>
      ) : null}

      {state === 'processing' ? (
        <section className="panel panel-state" aria-live="polite">
          {checking || !exhausted ? <Spinner label="Проверяем статус платежа…" /> : null}
          <p className="panel-text">
            Платёж обрабатывается. Это может занять до нескольких минут: доступ откроется автоматически,
            как только платёж будет подтверждён.
          </p>
          {exhausted ? (
            <>
              <p className="panel-text">
                Пока подтверждения нет. Страницу можно закрыть — подписка включится сама. Деньги за
                неподтверждённый платёж не списываются.
              </p>
              <button type="button" className="button button-secondary" onClick={() => void check()} disabled={checking}>
                Проверить ещё раз
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {state === 'failed' || state === 'canceled' ? (
        <section className="panel" aria-live="polite">
          <h2 className="panel-title">Платёж не подтверждён</h2>
          <p className="panel-text">
            Подписка не активирована. Если деньги были списаны, они вернутся автоматически —
            повторная оплата не требуется в течение суток.
          </p>
          <Link className="button button-secondary" to="/account/subscription">Вернуться к тарифам</Link>
        </section>
      ) : null}
    </>
  );
}
