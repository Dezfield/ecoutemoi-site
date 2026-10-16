import { useState } from 'react';
import { Link } from 'react-router';
import { requireSupabase } from '../../lib/supabase';
import { validateEmail, userFacingAuthError } from '../../auth/errors';
export function EmailPasswordForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <details className="email-password">
      <summary>Войти с паролем</summary>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          void (async () => {
            try {
              const { data, error } = await requireSupabase().auth.signInWithPassword({
                email: validateEmail(email),
                password,
              });
              if (error) throw error;
              if (!data.session) throw new Error('Сессия не подтверждена.');
              setPassword('');
            } catch (cause) {
              setError(userFacingAuthError(cause));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <label>
          Почта для входа с паролем
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="button button-primary" disabled={busy}>
          Войти с паролем
        </button>
        {error && <p role="alert">{error}</p>}
        <Link to="/forgot-password">Забыли пароль?</Link>
      </form>
    </details>
  );
}
