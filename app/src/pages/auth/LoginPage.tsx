import { Link, useLocation } from 'react-router';

import { useAuth } from '../../auth/AuthProvider';
import { Notice } from '../../components/Notice';
import { config } from '../../config';
import { AuthLayout } from '../../layouts/AuthLayout';
import { safeInternalPath } from '../../lib/redirect';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmailCodeForm } from './EmailCodeForm';
import { LegalNote, OAuthButtons, UnavailableProvidersNote } from './OAuthButtons';

type LoginState = { from?: unknown; notice?: unknown } | null;

export function LoginPage() {
  useDocumentTitle('Вход');
  const location = useLocation();
  const { error: authError, notice: authNotice } = useAuth();
  const state = location.state as LoginState;
  const nextPath = safeInternalPath(state?.from);
  const notice = typeof state?.notice === 'string' ? state.notice : authNotice;

  return (
    <AuthLayout>
      <h1 className="auth-title">Добро пожаловать</h1>
      <p className="auth-lead">Войдите, чтобы продолжить</p>
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {!config.supabaseConfigured ? (
        <Notice tone="error" title="Вход временно недоступен">
          <p>Сервис входа не настроен для этой сборки сайта. Попробуйте позже или используйте приложение.</p>
        </Notice>
      ) : (
        <>
          {authError ? <Notice tone="error">{authError}</Notice> : null}
          <OAuthButtons nextPath={nextPath} />
          {config.oauthProviders.length ? <div className="divider"><span>или</span></div> : null}
          <EmailCodeForm mode="login" />
          <UnavailableProvidersNote />
          <div className="auth-links">
            {config.signupEnabled ? (
              <p>
                Нет аккаунта? <Link to="/signup" state={state}>Создать аккаунт</Link>
              </p>
            ) : (
              <p>Нет аккаунта? Создайте его в приложении Écoute Moi.</p>
            )}
          </div>
          <LegalNote />
        </>
      )}
    </AuthLayout>
  );
}
