import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { deleteAccount } from '../../account/api';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';

/** Cancellation window before the request is sent (same three minutes as the app). */
export const DELETION_DELAY_MS = 3 * 60 * 1000;

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** HTTP status of a supabase-js FunctionsHttpError (its `context` is the Response). */
function httpStatus(error: unknown): number | null {
  const context = (error as { context?: { status?: unknown } } | null)?.context;
  return typeof context?.status === 'number' ? context.status : null;
}

function deletionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/failed to fetch|network|load failed|offline|relay/.test(message) && httpStatus(error) === null) {
    return 'Нет соединения с сервером. Аккаунт не удалён или удаление не завершено. Проверьте интернет и повторите.';
  }
  if (httpStatus(error) === 401) {
    return 'Сервер не принял текущую сессию. Если удаление уже завершилось, войти в этот аккаунт не получится. Иначе войдите снова и повторите удаление.';
  }
  return 'Удаление не завершено. Повторите попытку — сервер продолжит с того места, где остановился.';
}

type Phase = 'idle' | 'countdown' | 'deleting' | 'failed';

/**
 * Account deletion: confirmation → three-minute cancellable timer → the
 * protected `delete-my-account` Edge Function. The timer is only the time to
 * cancel; nothing is deleted from the browser directly. Success is shown only
 * after the Edge Function answers 200 with `{ deleted: true }`.
 */
export function DeleteAccountPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  const executing = useRef(false);

  const cancel = useCallback((reason?: string) => {
    if (executing.current) return;
    setDeadline(null);
    setPhase('idle');
    setError(null);
    setCancelledNotice(reason ?? 'Удаление отменено. Аккаунт сохранён.');
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancel('Удаление отменено, потому что вкладка была скрыта. Аккаунт сохранён.');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cancel, phase]);

  const execute = useCallback(async () => {
    if (executing.current) return;
    executing.current = true;
    setPhase('deleting');
    setDeadline(null);
    setError(null);
    try {
      await deleteAccount();
    } catch (nextError) {
      executing.current = false;
      setPhase('failed');
      setError(deletionErrorMessage(nextError));
      return;
    }
    // Deleted on the server: leave the private area first, then clear this
    // browser's session. No account data is requested after this point.
    navigate('/account-deleted', { replace: true });
    await signOut().catch(() => undefined);
  }, [navigate, signOut]);

  const remaining = deadline ? deadline - now : 0;

  useEffect(() => {
    if (phase === 'countdown' && deadline && remaining <= 0) void execute();
  }, [deadline, execute, phase, remaining]);

  const start = () => {
    setConfirming(false);
    setCancelledNotice(null);
    setError(null);
    const startedAt = Date.now();
    setNow(startedAt);
    setDeadline(startedAt + DELETION_DELAY_MS);
    setPhase('countdown');
  };

  return (
    <>
      <PageHeader eyebrow="Аккаунт" title="Удаление аккаунта">
        <p>Удаление необратимо. Выход из аккаунта — другое действие: он сохраняет профиль и данные.</p>
      </PageHeader>

      <section className="panel panel-danger" aria-labelledby="delete-what-title">
        <h2 id="delete-what-title" className="panel-title">Что произойдёт</h2>
        <ul className="bullet-list">
          <li>Вход в аккаунт будет закрыт на всех устройствах, включая приложение.</li>
          <li>Карточка, фотографии, аудиописьма, настройки и уведомления будут удалены.</li>
          <li>Разговоры будут закрыты. Записи, нужные для безопасности и модерации, сохранятся.</li>
        </ul>
        <p className="panel-text">
          Подробнее — на странице <a href={config.links.accountDeletion}>«Удаление аккаунта»</a>.
        </p>

        {phase === 'countdown' ? (
          <div className="countdown" role="timer" aria-live="off">
            <p className="eyebrow">Аккаунт пока не удалён</p>
            <p className="countdown-value" aria-hidden="true">{formatCountdown(remaining)}</p>
            <p className="visually-hidden" aria-live="polite">Удаление запустится через три минуты. Его можно отменить.</p>
            <p className="panel-text">
              Когда таймер закончится, аккаунт будет удалён. Если скрыть или закрыть вкладку, удаление отменится.
            </p>
            <button type="button" className="button button-primary" onClick={() => cancel()}>
              Отменить удаление
            </button>
          </div>
        ) : null}

        {phase === 'deleting' ? (
          <div className="countdown" role="status" aria-live="polite">
            <p className="countdown-progress">Удаляем аккаунт…</p>
            <p className="panel-text">Не закрывайте страницу, пока сервер не подтвердит удаление.</p>
          </div>
        ) : null}

        {phase === 'idle' ? (
          <div className="button-row">
            <button type="button" className="button button-danger" onClick={() => setConfirming(true)}>
              Удалить аккаунт
            </button>
          </div>
        ) : null}

        {phase === 'failed' ? (
          <>
            <Notice tone="error" title="Удаление не подтверждено">{error}</Notice>
            <div className="button-row">
              <button type="button" className="button button-danger" onClick={() => void execute()}>
                Повторить удаление
              </button>
              <button type="button" className="button button-ghost" onClick={() => cancel('Повтор удаления отложен. Если сервер уже начал удаление, профиль может быть скрыт — завершите удаление позже на этой странице.')}>
                Отложить
              </button>
            </div>
          </>
        ) : null}

        {cancelledNotice ? <Notice tone="info">{cancelledNotice}</Notice> : null}
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
          Запустится трёхминутный таймер. Пока он идёт, удаление можно отменить. После таймера вход будет закрыт, а
          профиль и личные медиа будут удалены.
        </p>
      </ConfirmDialog>
    </>
  );
}
