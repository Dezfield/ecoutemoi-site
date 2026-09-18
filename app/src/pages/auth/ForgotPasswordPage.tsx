import { type FormEvent, useId, useState } from 'react';
import { Link } from 'react-router';

import { userFacingAuthError } from '../../auth/errors';
import { sendPasswordRecovery } from '../../auth/service';
import { Notice } from '../../components/Notice';
import { config } from '../../config';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useDocumentTitle } from '../../lib/useDocumentTitle';

export function ForgotPasswordPage() {
  useDocumentTitle('Восстановление пароля');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const emailId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendPasswordRecovery(email);
      setSent(true);
    } catch (nextError) {
      setError(userFacingAuthError(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Восстановление пароля</h1>
      <p className="auth-lead">
        Пароль нужен только старым аккаунтам. Обычно войти проще по одноразовому коду из письма.
      </p>
      {!config.supabaseConfigured ? (
        <Notice tone="error">Сервис входа не настроен для этой сборки сайта.</Notice>
      ) : sent ? (
        <Notice tone="success" title="Проверьте почту">
          <p>
            Если аккаунт существует, ссылка для восстановления отправлена на email. Откройте её в этом же браузере.
          </p>
        </Notice>
      ) : (
        <form className="form" onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}>
          <div className="field">
            <label htmlFor={emailId}>Email</label>
            <input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </div>
          <button type="submit" className="button button-primary button-block" disabled={busy}>
            {busy ? 'Отправляем…' : 'Отправить ссылку'}
          </button>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </form>
      )}
      <div className="auth-links">
        <p><Link to="/login">Вернуться ко входу</Link></p>
      </div>
    </AuthLayout>
  );
}
