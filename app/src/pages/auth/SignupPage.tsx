import { Link, useLocation } from 'react-router';

import { Notice } from '../../components/Notice';
import { config } from '../../config';
import { AuthLayout } from '../../layouts/AuthLayout';
import { safeInternalPath } from '../../lib/redirect';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmailCodeForm } from './EmailCodeForm';
import { LegalNote, OAuthButtons, UnavailableProvidersNote } from './OAuthButtons';

/**
 * Creates only the shared Supabase auth account. The dating profile
 * (birth date, audio letter, photos) is created in the mobile onboarding;
 * the web never writes placeholder values into dating_profiles.
 */
export function SignupPage() {
  useDocumentTitle('Создать аккаунт');
  const location = useLocation();
  const state = location.state as { from?: unknown } | null;
  const nextPath = safeInternalPath(state?.from);

  return (
    <AuthLayout>
      <h1 className="auth-title">Создать аккаунт</h1>
      <p className="auth-lead">Один аккаунт для приложения и сайта</p>
      {!config.supabaseConfigured ? (
        <Notice tone="error" title="Регистрация временно недоступна">
          <p>Сервис входа не настроен для этой сборки сайта. Попробуйте позже или используйте приложение.</p>
        </Notice>
      ) : (
        <>
          <OAuthButtons nextPath={nextPath} />
          {config.oauthProviders.length ? <div className="divider"><span>или</span></div> : null}
          <EmailCodeForm mode="signup" />
          <p className="form-footnote">
            После подтверждения почты завершите анкету в приложении Écoute Moi: аудиописьмо, фотографии и возраст
            указываются там.
          </p>
          <UnavailableProvidersNote />
          <div className="auth-links">
            <p>
              Уже есть аккаунт? <Link to="/login" state={state}>Войти</Link>
            </p>
          </div>
          <LegalNote />
        </>
      )}
    </AuthLayout>
  );
}
