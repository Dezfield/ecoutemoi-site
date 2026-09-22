import { useState } from 'react';

import {
  appleSubscriptionsUrl,
  billingErrorMessage,
  cancelAutoRenew,
  durationLabel,
  formatPrice,
  loadBillingOffers,
  loadBillingStatus,
  startCheckout,
  tierLabel,
} from '../../account/billing';
import type { BillingOffer, BillingStatus } from '../../account/types';
import { useAuth } from '../../auth/AuthProvider';
import { AsyncState } from '../../components/AsyncState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

/**
 * Subscription management for an Écoute Moi account.
 *
 * The status shown here is the effective level of the account, whatever it was
 * paid with, so a subscription bought in the app and one bought here look the
 * same. Prices are never decided in the browser: the tariffs come from the
 * backend and a purchase sends nothing but an offer id.
 */
function statusText(status: BillingStatus): string {
  if (status.unlimited) return 'Бессрочный статус.';
  if (status.active) {
    const until = status.expiresAt ? `Действует до ${formatDate(status.expiresAt)}` : 'Подписка активна.';
    if (status.cancelAtPeriodEnd) return `${until}. Автопродление отключено — дальше списаний не будет.`;
    return status.autoRenew ? `${until}. Автопродление включено.` : `${until}. Автопродление отключено.`;
  }
  return status.expiresAt
    ? `Подписка не активна. Срок действия закончился ${formatDate(status.expiresAt)}`
    : 'Подписка не активна.';
}

export function SubscriptionPage() {
  const { user } = useAuth();
  const status = useAsync(loadBillingStatus, billingErrorMessage, [user?.id]);
  const offers = useAsync(loadBillingOffers, billingErrorMessage, [user?.id]);
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [recurring, setRecurring] = useState<Record<string, boolean>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const buy = async (offer: BillingOffer) => {
    setBusyOffer(offer.id);
    setMessage(null);
    try {
      const checkout = await startCheckout(offer.id, Boolean(recurring[offer.id]) && offer.recurringAllowed);
      if (checkout.notice === 'already_active') {
        // Allowed - it prolongs access - but never silently.
        setMessage({
          tone: 'info',
          text: 'На аккаунте уже есть подписка этого уровня. Оплата продлит её, а не начнёт вторую.',
        });
      }
      // The provider's page is the only place a payment is made.
      window.location.assign(checkout.confirmationUrl);
    } catch (error) {
      setMessage({ tone: 'error', text: billingErrorMessage(error) });
      setBusyOffer(null);
    }
  };

  const confirmCancel = async () => {
    setCanceling(true);
    setMessage(null);
    try {
      await cancelAutoRenew();
      status.reload();
      setMessage({
        tone: 'success',
        text: 'Автопродление отключено. Оплаченный период сохраняется полностью.',
      });
    } catch (error) {
      setMessage({ tone: 'error', text: billingErrorMessage(error) });
    } finally {
      setCanceling(false);
      setCancelOpen(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Подписка" title="Premium и Exclusive">
        <p>
          Подписка принадлежит вашему аккаунту Écoute Moi, а не устройству. После оплаты она работает и на сайте,
          и в приложении на том же аккаунте — восстанавливать покупку не нужно.
        </p>
      </PageHeader>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <AsyncState
        loading={status.loading}
        error={status.error}
        data={status.data}
        onRetry={status.reload}
        loadingLabel="Загружаем статус…"
      >
        {(data) => (
          <>
            <section className={`panel plan-panel ${data.active ? 'plan-panel-active' : ''}`} aria-labelledby="plan-title">
              <p className="eyebrow">Ваш статус</p>
              <h2 id="plan-title" className="plan-name">{tierLabel(data.tier)}</h2>
              <p className="panel-text">{statusText(data)}</p>
              {data.paymentPending ? (
                <p className="panel-text">
                  Платёж обрабатывается. Доступ откроется автоматически, как только банк подтвердит оплату.
                </p>
              ) : null}

              {/* Управление зависит от того, где подписка оформлена. */}
              {data.manageProvider === 'apple' ? (
                <p className="panel-text">
                  Эта подписка оформлена в App Store.{' '}
                  <a href={appleSubscriptionsUrl()} target="_blank" rel="noreferrer noopener">
                    Управлять ею можно в настройках Apple
                  </a>.
                </p>
              ) : null}
              {data.manageProvider === 'yookassa' && data.autoRenew ? (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setCancelOpen(true)}
                  disabled={canceling}
                >
                  Отключить автопродление
                </button>
              ) : null}
            </section>

            <AsyncState
              loading={offers.loading}
              error={offers.error}
              data={offers.data}
              onRetry={offers.reload}
              loadingLabel="Загружаем тарифы…"
            >
              {(list) =>
                list.length ? (
                  <section className="panel" aria-labelledby="offers-title">
                    <h2 id="offers-title" className="panel-title">
                      {data.active ? 'Продлить или повысить уровень' : 'Выбрать тариф'}
                    </h2>
                    <ul className="list">
                      {list.map((offer) => (
                        <li key={offer.id} className="list-row">
                          <span className="list-main">
                            <span className="list-title">{offer.title}</span>
                            <span className="list-meta">
                              {formatPrice(offer)} · {durationLabel(offer.durationDays)}
                              {offer.description ? ` · ${offer.description}` : ''}
                            </span>
                            {offer.recurringAllowed ? (
                              <label className="list-meta">
                                <input
                                  type="checkbox"
                                  checked={Boolean(recurring[offer.id])}
                                  onChange={(event) =>
                                    setRecurring((current) => ({ ...current, [offer.id]: event.target.checked }))
                                  }
                                  disabled={busyOffer !== null}
                                />{' '}
                                Продлевать автоматически каждые {durationLabel(offer.durationDays)} по {formatPrice(offer)}.
                                Отключить можно на этой странице в любой момент.
                              </label>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            className="button button-primary button-small"
                            onClick={() => void buy(offer)}
                            disabled={busyOffer !== null}
                            aria-label={`Оплатить: ${offer.title}, ${formatPrice(offer)}`}
                          >
                            {busyOffer === offer.id ? 'Переходим к оплате…' : 'Оплатить'}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="panel-text">
                      Оплата проходит на защищённой странице платёжного сервиса. Данные карты не попадают
                      в Écoute Moi.
                    </p>
                  </section>
                ) : (
                  <section className="panel empty-state">
                    <h2 className="panel-title">Оплата на сайте пока не открыта</h2>
                    <p className="panel-text">
                      Тарифы появятся здесь, когда оплата будет включена. Уже активная подписка продолжает работать.
                    </p>
                  </section>
                )
              }
            </AsyncState>
          </>
        )}
      </AsyncState>

      <ConfirmDialog
        open={cancelOpen}
        title="Отключить автопродление?"
        confirmLabel="Отключить"
        busy={canceling}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelOpen(false)}
      >
        <p>
          Оплаченный период сохранится полностью — доступ не отключится сразу. Новых списаний не будет.
        </p>
      </ConfirmDialog>
    </>
  );
}
