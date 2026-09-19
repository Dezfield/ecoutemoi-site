import { useState } from 'react';

import { accountErrorMessage, loadAccountRestriction, signOutOtherSessions } from '../../account/api';
import { restrictionLabels } from '../../account/labels';
import { useAuth } from '../../auth/AuthProvider';
import { AsyncState } from '../../components/AsyncState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

/**
 * Account status from get_my_account_restriction(): the caller's own active
 * suspension or ban. The RPC returns no sanction id, so the web offers no
 * appeal form; the appeal RPC needs that id and the user must never type it.
 */
function AccountStatus() {
  const { user } = useAuth();
  const restriction = useAsync(
    // useAsync treats null as "no data yet", so the result is wrapped.
    async () => ({ current: await loadAccountRestriction() }),
    accountErrorMessage,
    [user?.id],
  );
  return (
    <section className="panel" aria-labelledby="status-title">
      <h2 id="status-title" className="panel-title">Статус аккаунта</h2>
      <AsyncState loading={restriction.loading} error={restriction.error} data={restriction.data} onRetry={restriction.reload}>
        {({ current }) =>
          current ? (
            <>
              <p className="panel-text">
                <span className="status-pill status-warn">{restrictionLabels[current.kind]}</span>
              </p>
              {current.reason ? <p className="panel-text">{current.reason}</p> : null}
              <p className="panel-note">
                {current.expiresAt ? `Действует до: ${formatDateTime(current.expiresAt)}` : 'Срок окончания не указан.'}
              </p>
              <p className="panel-text">
                Обжаловать ограничение через сайт пока нельзя. Каналы связи с Écoute Moi — на{' '}
                <a href={config.links.support}>странице поддержки</a>.
              </p>
            </>
          ) : (
            <p className="panel-text">
              <span className="status-pill status-ok">Активных ограничений нет</span>
            </p>
          )
        }
      </AsyncState>
    </section>
  );
}

/**
 * No backend in ecoutemoi-mobile main lists a user's sessions, so the web
 * shows no device list or session count. Ending the other sessions uses the
 * standard Supabase Auth logout with scope `others`.
 */
function OtherSessions() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const endOthers = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signOutOtherSessions();
      setMessage({ tone: 'success', text: 'Вход на других устройствах и в других браузерах завершён.' });
    } catch (error) {
      setMessage({ tone: 'error', text: accountErrorMessage(error) });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="sessions-title">
      <h2 id="sessions-title" className="panel-title">Активные сессии</h2>
      <p className="panel-text">Просмотр активных сессий на сайте пока недоступен.</p>
      <p className="panel-text">
        Можно завершить вход на всех других устройствах и в других браузерах, включая приложение. Этот браузер
        останется в аккаунте.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="button button-danger-outline"
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          Завершить другие сессии
        </button>
      </div>
      <p className="panel-note">
        Уже выданный короткоживущий токен доступа может оставаться действительным до окончания срока, но обновить его
        после завершения сессии нельзя.
      </p>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <ConfirmDialog
        open={confirming}
        title="Завершить другие сессии?"
        confirmLabel="Завершить"
        danger
        busy={busy}
        onConfirm={() => void endOthers()}
        onCancel={() => setConfirming(false)}
      >
        <p>На других устройствах, включая приложение, потребуется войти снова. Текущая сессия останется активной.</p>
      </ConfirmDialog>
    </section>
  );
}

export function SecurityPage() {
  return (
    <>
      <PageHeader eyebrow="Безопасность" title="Безопасность">
        <p>Статус аккаунта и завершение входа на других устройствах.</p>
      </PageHeader>
      <AccountStatus />
      <OtherSessions />
      <section className="panel panel-muted" aria-labelledby="protection-title">
        <h2 id="protection-title" className="panel-title">Защита в общении</h2>
        <p className="panel-text">
          В разговорах в приложении доступны жалоба, блокировка, ограничение контакта и инструменты безопасной встречи.
          Точная геопозиция не отображается в публичной карточке.
        </p>
      </section>
    </>
  );
}
