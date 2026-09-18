import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { accountErrorMessage, deleteAccount } from '../../account/api';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';

/** Same grace period as mobile (PROFILE_DELETION_DELAY_MS): three minutes. */
const DELETION_DELAY_MS = 3 * 60 * 1000;

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Account deletion mirrors the mobile flow: confirmation → three-minute
 * cancellable timer (cancelled if the page is hidden or left, like the app
 * cancels it when backgrounded) → the protected `delete-my-account` Edge
 * Function. Nothing is deleted from the browser directly.
 */
export function DeleteAccountPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  const executing = useRef(false);

  const cancel = useCallback((reason?: string) => {
    if (executing.current) return;
    setDeadline(null);
    setCancelledNotice(reason ?? 'Удаление отменено. Аккаунт сохранён.');
  }, []);

  useEffect(() => {
    if (!deadline) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancel('Удаление отменено, потому что вкладка была скрыта. Аккаунт сохранён.');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cancel, deadline]);

  const execute = useCallback(async () => {
    if (executing.current) return;
    executing.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      navigate('/account-deleted', { replace: true });
      await signOut().catch(() => undefined);
    } catch (nextError) {
      executing.current = false;
      setDeadline(null);
      setBusy(false);
      setError(accountErrorMessage(nextError));
    }
  }, [navigate, signOut]);

  const remaining = deadline ? deadline - now : 0;

  useEffect(() => {
    if (deadline && remaining <= 0) void execute();
  }, [deadline, execute, remaining]);

  const start = () => {
    setConfirming(false);
    setCancelledNotice(null);
    setError(null);
    setNow(Date.now());
    setDeadline(Date.now() + DELETION_DELAY_MS);
  };

  return (
    <>
      <PageHeader eyebrow="Аккаунт" title="Удалить аккаунт">
        <p>Удаление необратимо. Выход из аккаунта — другое действие: он сохраняет профиль и данные.</p>
      </PageHeader>

      <section className="panel panel-danger" aria-labelledby="delete-what-title">
        <h2 id="delete-what-title" className="panel-title">Что произойдёт</h2>
        <ul className="bullet-list">
          <li>Вход в аккаунт будет закрыт на всех устройствах, включая приложение.</li>
          <li>Карточка, личные медиа, Резонансы и разговоры будут удалены.</li>
          <li>Необходимые записи безопасности сохранятся обезличенно.</li>
        </ul>
        <p className="panel-text">
          Подробнее — на странице <a href={config.links.accountDeletion}>«Удаление аккаунта»</a>.
        </p>

        {deadline ? (
          <div className="countdown" role="timer" aria-live="off">
            <p className="eyebrow">Аккаунт пока не удалён</p>
            <p className="countdown-value" aria-hidden="true">{formatCountdown(remaining)}</p>
            <p className="visually-hidden" aria-live="polite">
              {busy ? 'Удаляем аккаунт.' : 'Удаление запустится через три минуты. Его можно отменить.'}
            </p>
            <p className="panel-text">
              {busy
                ? 'Удаляем аккаунт…'
                : 'Когда таймер закончится, аккаунт будет удалён. Если скрыть или закрыть вкладку, удаление отменится.'}
            </p>
            <button type="button" className="button button-primary" onClick={() => cancel()} disabled={busy}>
              Отменить удаление
            </button>
          </div>
        ) : (
          <div className="button-row">
            <button type="button" className="button button-danger" onClick={() => setConfirming(true)}>
              Удалить аккаунт
            </button>
          </div>
        )}
        {cancelledNotice ? <Notice tone="info">{cancelledNotice}</Notice> : null}
        {error ? <Notice tone="error" title="Не удалось удалить аккаунт">{error}</Notice> : null}
      </section>

      <ConfirmDialog
        open={confirming}
        title="Удалить аккаунт?"
        confirmLabel="Запустить таймер"
        cancelLabel="Не удалять"
        danger
        onConfirm={start}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Запустится трёхминутный таймер. Пока он идёт, удаление можно отменить. После таймера вход будет закрыт, профиль
          и личные медиа будут удалены, а необходимые записи безопасности сохранятся обезличенно.
        </p>
      </ConfirmDialog>
    </>
  );
}
