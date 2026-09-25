import { useState } from 'react';

import { accountErrorMessage, loadBlockedUsers, unblockUser } from '../../account/api';
import type { BlockedUser } from '../../account/types';
import { useAuth } from '../../auth/AuthProvider';
import { AsyncState } from '../../components/AsyncState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, initials } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function BlockedPage() {
  const { user } = useAuth();
  const blocked = useAsync(loadBlockedUsers, accountErrorMessage, [user?.id]);
  const [pending, setPending] = useState<BlockedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const confirmUnblock = async () => {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    try {
      await unblockUser(pending.id);
      blocked.setData((blocked.data ?? []).filter((item) => item.id !== pending.id));
      setMessage({ tone: 'success', text: `${pending.name} разблокирован(а).` });
    } catch (error) {
      setMessage({ tone: 'error', text: accountErrorMessage(error) });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Безопасность" title="Заблокированные пользователи">
        <p>Пользователи, которых вы заблокировали в разговорах. Заблокировать человека можно в разделе безопасности разговора в приложении.</p>
      </PageHeader>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <AsyncState
        loading={blocked.loading}
        error={blocked.error}
        data={blocked.data}
        onRetry={blocked.reload}
        loadingLabel="Загружаем список…"
      >
        {(list) =>
          list.length ? (
            <section className="panel" aria-label="Список заблокированных">
              <ul className="list">
                {list.map((item) => (
                  <li key={item.id} className="list-row">
                    <span className="avatar avatar-small" aria-hidden="true"><span>{initials(item.name)}</span></span>
                    <span className="list-main">
                      <span className="list-title">{item.name}</span>
                      <span className="list-meta">Заблокирован(а) {formatDate(item.blockedAt)}</span>
                    </span>
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => setPending(item)}
                      disabled={busy}
                      aria-label={`Разблокировать: ${item.name}`}
                    >
                      Разблокировать
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="panel empty-state">
              <h2 className="panel-title">Список пуст</h2>
              <p className="panel-text">Здесь появятся пользователи, которых вы заблокировали.</p>
            </section>
          )
        }
      </AsyncState>
      <ConfirmDialog
        open={pending !== null}
        title="Разблокировать пользователя?"
        confirmLabel="Разблокировать"
        busy={busy}
        onConfirm={() => void confirmUnblock()}
        onCancel={() => setPending(null)}
      >
        <p>
          Блокировка пользователя «{pending?.name ?? 'Пользователь'}» будет снята. При необходимости заблокировать снова
          можно в разделе безопасности разговора в приложении.
        </p>
      </ConfirmDialog>
    </>
  );
}
