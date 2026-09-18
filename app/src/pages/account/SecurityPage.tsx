import { type FormEvent, useId, useState } from 'react';

import {
  accountErrorMessage,
  appealErrorMessage,
  loadActiveSessions,
  loadSafetyCenter,
  signOutOtherSessions,
  submitAppeal,
} from '../../account/api';
import { appealLabels, reportCategoryLabels, reportLabels, sanctionLabels } from '../../account/labels';
import type { SafetySanction } from '../../account/types';
import { useAuth } from '../../auth/AuthProvider';
import { AsyncState } from '../../components/AsyncState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime, sessionDeviceLabel } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

function AppealForm({ sanction, onSubmitted }: { sanction: SafetySanction; onSubmitted: () => void }) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const hintId = useId();

  const validate = (event: FormEvent) => {
    event.preventDefault();
    const length = reason.trim().length;
    if (length < 20 || length > 1500) {
      setError('Опишите ситуацию текстом от 20 до 1500 символов.');
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const send = async () => {
    setBusy(true);
    try {
      await submitAppeal(sanction.id, reason);
      setReason('');
      setConfirming(false);
      onSubmitted();
    } catch (nextError) {
      setConfirming(false);
      setError(appealErrorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form appeal-form" onSubmit={validate} noValidate>
      <h3 className="panel-subtitle">Не согласны с решением?</h3>
      <div className="field">
        <label htmlFor={fieldId}>Что важно учесть при повторной проверке?</label>
        <textarea
          id={fieldId}
          rows={5}
          maxLength={1500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-describedby={hintId}
          aria-invalid={Boolean(error)}
        />
        <p id={hintId} className="field-hint">
          Опишите контекст спокойно и по существу, от 20 до 1500 символов. Обращение проверит другой сотрудник, если
          это возможно.
        </p>
      </div>
      <button type="submit" className="button button-secondary">Отправить обращение</button>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ConfirmDialog
        open={confirming}
        title="Отправить обращение?"
        confirmLabel="Отправить"
        busy={busy}
        onConfirm={() => void send()}
        onCancel={() => setConfirming(false)}
      >
        <p>Обращение попадёт в отдельную очередь модерации. Для одного ограничения можно отправить одно обращение.</p>
      </ConfirmDialog>
    </form>
  );
}

function SafetyStatus() {
  const { user } = useAuth();
  const center = useAsync(loadSafetyCenter, accountErrorMessage, [user?.id]);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <section className="panel" aria-labelledby="status-title">
      <h2 id="status-title" className="panel-title">Статус аккаунта</h2>
      <AsyncState loading={center.loading} error={center.error} data={center.data} onRetry={center.reload}>
        {(data) => (
          <>
            <p className="panel-text">
              <span className={`status-pill ${data.activeSanction ? 'status-warn' : 'status-ok'}`}>
                {data.activeSanction ? sanctionLabels[data.activeSanction.kind] : 'Ограничений нет'}
              </span>
            </p>
            {data.activeSanction ? (
              <>
                <p className="panel-text">{data.activeSanction.reason || 'Причина не указана.'}</p>
                <p className="panel-note">
                  {data.activeSanction.expiresAt
                    ? `Действует до: ${formatDateTime(data.activeSanction.expiresAt)}`
                    : 'Срок действия не указан.'}
                </p>
                {data.activeSanction.appeal ? (
                  <p className="panel-text">
                    Обращение: {appealLabels[data.activeSanction.appeal.status]} · отправлено{' '}
                    {formatDateTime(data.activeSanction.appeal.createdAt)}
                  </p>
                ) : (
                  <AppealForm
                    sanction={data.activeSanction}
                    onSubmitted={() => {
                      setNotice('Обращение отправлено. Статус появится здесь после рассмотрения.');
                      center.reload();
                    }}
                  />
                )}
              </>
            ) : null}
            {notice ? <Notice tone="success">{notice}</Notice> : null}
            <h3 className="panel-subtitle">Мои жалобы</h3>
            {data.recentReports.length ? (
              <ul className="list">
                {data.recentReports.map((report) => (
                  <li key={report.id} className="list-row">
                    <span className="list-main">
                      <span className="list-title">{reportCategoryLabels[report.category] ?? reportCategoryLabels.other}</span>
                      <span className="list-meta">{formatDateTime(report.createdAt)}</span>
                    </span>
                    <span className="status-pill">{reportLabels[report.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-text">Вы ещё не отправляли жалоб.</p>
            )}
          </>
        )}
      </AsyncState>
    </section>
  );
}

function ActiveSessions() {
  const { user } = useAuth();
  const sessions = useAsync(loadActiveSessions, accountErrorMessage, [user?.id]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const others = sessions.data?.filter((session) => !session.current).length ?? 0;

  const endOthers = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signOutOtherSessions();
      setMessage({ tone: 'success', text: 'Другие сессии завершены. На остальных устройствах потребуется повторный вход.' });
      sessions.reload();
    } catch (error) {
      setMessage({ tone: 'error', text: accountErrorMessage(error) });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="sessions-title">
      <div className="panel-head">
        <h2 id="sessions-title" className="panel-title">Активные сессии</h2>
        <button type="button" className="button button-ghost button-small" onClick={sessions.reload} disabled={sessions.loading}>
          Обновить
        </button>
      </div>
      <p className="panel-text">Устройства и браузеры, на которых сохранён вход в ваш аккаунт.</p>
      <AsyncState loading={sessions.loading} error={sessions.error} data={sessions.data} onRetry={sessions.reload}>
        {(list) =>
          list.length ? (
            <ul className="list">
              {list.map((session) => (
                <li key={session.id} className={`list-row ${session.current ? 'list-row-current' : ''}`}>
                  <span className="list-main">
                    <span className="list-title">
                      {sessionDeviceLabel(session.userAgent)}
                      {session.current ? <span className="status-pill status-ok">Этот браузер</span> : null}
                    </span>
                    <span className="list-meta">Последняя активность: {formatDateTime(session.updatedAt)}</span>
                    {session.ipAddress ? <span className="list-meta">IP: {session.ipAddress}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-text">Активные сессии не найдены.</p>
          )
        }
      </AsyncState>
      <div className="button-row">
        <button
          type="button"
          className="button button-danger-outline"
          onClick={() => setConfirming(true)}
          disabled={!others || busy}
        >
          Завершить другие сессии{others ? ` · ${others}` : ''}
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
        <p>На других устройствах потребуется войти снова. Текущая сессия останется активной.</p>
      </ConfirmDialog>
    </section>
  );
}

export function SecurityPage() {
  return (
    <>
      <PageHeader eyebrow="Безопасность" title="Безопасность">
        <p>Статус аккаунта, обращения и устройства, на которых выполнен вход.</p>
      </PageHeader>
      <SafetyStatus />
      <ActiveSessions />
      <section className="panel panel-muted" aria-labelledby="protection-title">
        <h2 id="protection-title" className="panel-title">Защита в общении</h2>
        <p className="panel-text">
          В каждом разговоре доступны жалоба, блокировка, ограничение контакта и инструменты безопасной встречи. Точная
          геопозиция не отображается в публичной карточке.
        </p>
      </section>
    </>
  );
}
