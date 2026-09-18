import { useState } from 'react';

import { AUTH_CANCELLED_MESSAGE, authErrorMessage } from '../../auth/errors';
import { startOAuth } from '../../auth/service';
import { Notice } from '../../components/Notice';
import { config } from '../../config';
import type { OAuthProvider } from '../../lib/env';

const providerLabels: Record<OAuthProvider, string> = {
  apple: 'Продолжить с Apple',
  google: 'Продолжить с Google',
};

/**
 * Only providers explicitly enabled for the web build
 * (VITE_AUTH_OAUTH_PROVIDERS) are rendered, so the page never offers a
 * provider whose web redirect is not configured.
 */
export function OAuthButtons({ nextPath }: { nextPath: string }) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!config.oauthProviders.length) return null;

  const start = async (provider: OAuthProvider) => {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      await startOAuth(provider, nextPath); // navigates away on success
    } catch (nextError) {
      const message = authErrorMessage(nextError);
      if (message !== AUTH_CANCELLED_MESSAGE) setError(message);
      setBusy(null);
    }
  };

  return (
    <div className="oauth">
      {config.oauthProviders.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`button button-provider button-provider-${provider}`}
          onClick={() => void start(provider)}
          disabled={Boolean(busy)}
        >
          {busy === provider ? 'Переходим…' : providerLabels[provider]}
        </button>
      ))}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

/** Honest note about sign-in methods that exist in the app but not yet on the web. */
export function UnavailableProvidersNote() {
  const missing = [
    !config.oauthProviders.includes('apple') ? 'Apple' : null,
    !config.oauthProviders.includes('google') ? 'Google' : null,
    'VK',
  ].filter(Boolean);
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} и ${missing[missing.length - 1]}` : missing[0];
  return (
    <p className="form-footnote">
      Вход через {list} на сайте появится позже. Если вы регистрировались этим способом, откройте приложение
      Écoute Moi или войдите по почте, привязанной к аккаунту.
    </p>
  );
}

export function LegalNote() {
  return (
    <p className="legal-note">
      <span className="age-badge">18+</span> Только для совершеннолетних. Продолжая, вы принимаете{' '}
      <a href={config.links.terms}>Условия использования</a> и{' '}
      <a href={config.links.privacy}>Политику конфиденциальности</a>.
    </p>
  );
}
