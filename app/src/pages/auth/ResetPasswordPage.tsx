import { type FormEvent, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '../../auth/AuthProvider';
import { userFacingAuthError } from '../../auth/errors';
import { setRecoveredPassword } from '../../auth/service';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Notice } from '../../components/Notice';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useDocumentTitle } from '../../lib/useDocumentTitle';

/** Only usable with a session that came from a password recovery link. */
export function ResetPasswordPage() {
  useDocumentTitle('Новый пароль');
  const { status, completePasswordRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordId = useId();
  const confirmId = useId();
  const rulesId = useId();

  if (status === 'initializing') return <LoadingScreen label="Проверяем ссылку…" />;

  if (status !== 'password_recovery') {
    return (
      <AuthLayout>
        <h1 className="auth-title">Ссылка недействительна</h1>
        <Notice tone="info">
          Ссылка для восстановления устарела или уже использована. Запросите новую — или войдите по коду из письма.
        </Notice>
        <div className="auth-links">
          <p><Link to="/forgot-password">Запросить новую ссылку</Link></p>
          <p><Link to="/login">Вернуться ко входу</Link></p>
        </div>
      </AuthLayout>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setRecoveredPassword(password, confirmation);
      await completePasswordRecovery();
      navigate('/account', { replace: true });
    } catch (nextError) {
      setError(userFacingAuthError(nextError));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await signOut().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Новый пароль</h1>
      <p className="auth-lead">Придумайте новый пароль для входа в аккаунт.</p>
      <form className="form" onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}>
        <p id={rulesId} className="form-hint">Не менее 8 символов, буквы и цифры.</p>
        <div className="field">
          <label htmlFor={passwordId}>Новый пароль</label>
          <input
            id={passwordId}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={rulesId}
            aria-invalid={Boolean(error)}
          />
        </div>
        <div className="field">
          <label htmlFor={confirmId}>Повторите пароль</label>
          <input
            id={confirmId}
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
        <button type="submit" className="button button-primary button-block" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
      <div className="auth-links">
        <p><button type="button" className="text-button" onClick={() => void cancel()}>Отменить и выйти</button></p>
      </div>
    </AuthLayout>
  );
}
