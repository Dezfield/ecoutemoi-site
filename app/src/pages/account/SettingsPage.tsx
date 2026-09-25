import { useState } from 'react';
import { Link } from 'react-router';

import { accountErrorMessage, exportAccountData, loadLoginMethods } from '../../account/api';
import { useAuth } from '../../auth/AuthProvider';
import type { LoginProvider } from '../../auth/types';
import { AsyncState } from '../../components/AsyncState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

const providerLabels: Record<LoginProvider, string> = {
  apple: 'Apple ID',
  google: 'Google',
  vk: 'VK ID',
  email: 'Почта',
};

/** Saves the export as a local file; nothing is uploaded anywhere. */
function downloadJson(payload: unknown, fileName: string) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const methods = useAsync(loadLoginMethods, accountErrorMessage, [user?.id]);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const data = await exportAccountData();
      downloadJson(data, `ecoute-moi-data-${new Date().toISOString().slice(0, 10)}.json`);
      setExportMessage({ tone: 'success', text: 'Файл с копией данных сохранён на этом устройстве.' });
    } catch (error) {
      setExportMessage({ tone: 'error', text: accountErrorMessage(error) });
    } finally {
      setExporting(false);
    }
  };

  const performSignOut = async () => {
    setSigningOut(true);
    try {
      // ProtectedRoute sends the signed-out visitor to /login, where the notice is shown.
      await signOut('Вы вышли из аккаунта. Профиль и данные сохранены.');
    } catch {
      setSigningOut(false);
      setConfirmSignOut(false);
      setSignOutError('Не удалось выйти. Проверьте соединение и попробуйте ещё раз.');
    }
  };

  const emailConfirmed = Boolean(user?.email_confirmed_at);

  return (
    <>
      <PageHeader eyebrow="Мой аккаунт" title="Аккаунт и вход">
        <p>Данные входа в ваш аккаунт Écoute Moi.</p>
      </PageHeader>

      <section className="panel" aria-labelledby="account-title">
        <h2 id="account-title" className="panel-title">Данные аккаунта</h2>
        <dl className="details">
          <div className="details-row">
            <dt>Почта</dt>
            <dd>
              {user?.email ?? 'Не указана'}
              {user?.email ? (
                <span className={`status-pill ${emailConfirmed ? 'status-ok' : ''}`}>
                  {emailConfirmed ? 'Подтверждена' : 'Не подтверждена'}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="details-row">
            <dt>Аккаунт создан</dt>
            <dd>{formatDate(user?.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="methods-title">
        <h2 id="methods-title" className="panel-title">Способы входа</h2>
        <p className="panel-text">
          Способы входа относятся к одному аккаунту, только если они уже связаны с ним. Управление способами входа
          выполняется в приложении. На сайте сейчас доступен вход по коду на почту.
        </p>
        <AsyncState loading={methods.loading} error={methods.error} data={methods.data} onRetry={methods.reload}>
          {(list) => (
            <ul className="list">
              {list.map((method) => (
                <li key={method.provider} className="list-row">
                  <span className="list-main">
                    <span className="list-title">{providerLabels[method.provider]}</span>
                    {method.label ? <span className="list-meta">{method.label}</span> : null}
                  </span>
                  <span className={`status-pill ${method.connected ? 'status-ok' : ''}`}>
                    {method.connected ? 'Подключено' : 'Не подключено'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AsyncState>
      </section>

      <section className="panel" aria-labelledby="export-title">
        <h2 id="export-title" className="panel-title">Копия моих данных</h2>
        <p className="panel-text">
          Файл JSON с данными вашего аккаунта и созданным вами содержимым. Сообщения других людей и служебные данные
          модерации в него не входят.
        </p>
        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={() => void exportData()} disabled={exporting}>
            {exporting ? 'Готовим файл…' : 'Скачать копию данных'}
          </button>
        </div>
        {exportMessage ? <Notice tone={exportMessage.tone}>{exportMessage.text}</Notice> : null}
      </section>

      <section className="panel" aria-labelledby="session-title">
        <h2 id="session-title" className="panel-title">Выход и удаление</h2>
        <p className="panel-text">Выход завершает вход только в этом браузере. Удаление аккаунта необратимо.</p>
        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={() => setConfirmSignOut(true)}>
            Выйти
          </button>
          <Link to="/account/delete" className="button button-ghost">Удаление аккаунта</Link>
        </div>
        {signOutError ? <Notice tone="error">{signOutError}</Notice> : null}
      </section>

      <ConfirmDialog
        open={confirmSignOut}
        title="Выйти из аккаунта?"
        confirmLabel="Выйти"
        busy={signingOut}
        onConfirm={() => void performSignOut()}
        onCancel={() => setConfirmSignOut(false)}
      >
        <p>Вы выйдете только в этом браузере. Профиль, Резонансы и разговоры останутся в вашем аккаунте.</p>
      </ConfirmDialog>
    </>
  );
}
