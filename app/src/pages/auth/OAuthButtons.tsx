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
 * (VITE_AUTH_OAUTH_PROVIDERS, and only while web signup is enabled — see
 * config.ts) are rendered, so the page never offers a provider whose web
 * redirect is not configured.
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

/**
 * Sign-in methods that the web does not offer. The note does not promise that
 * an email code opens the same account as another sign-in method: that holds
 * only when this email is the one stored in that account.
 */
const oauthNames: Array<[OAuthProvider, string]> = [['apple', 'Apple'], ['google', 'Google']];

export function UnavailableProvidersNote() {
  const missing = [
    'по номеру телефона',
    ...oauthNames.filter(([provider]) => !config.oauthProviders.includes(provider)).map(([, name]) => `через ${name}`),
    'через VK',
  ];
  const list = `${missing.slice(0, -1).join(', ')} и ${missing[missing.length - 1]}`;
  return (
    <p className="form-footnote">
      Вход {list} на сайте пока недоступен. Если вы входите в приложение этими способами, пользуйтесь приложением
      Écoute Moi: вход по коду на почту не обязательно откроет тот же аккаунт.
    </p>
  );
}

/**
 * Age notice and links to the public documents. The Terms and the Privacy
 * Policy on the public site are not approved yet, so the web does not state
 * that continuing means accepting them; consent wording is a release blocker
 * for web signup (docs/WEB_APP_DEPLOYMENT.md).
 */
export function LegalNote() {
  return (
    <p className="legal-note">
      <span className="age-badge">18+</span> Только для совершеннолетних. Документы сервиса:{' '}
      <a href={config.links.terms}>Пользовательское соглашение</a> и{' '}
      <a href={config.links.privacy}>Политика конфиденциальности</a>.
    </p>
  );
}
