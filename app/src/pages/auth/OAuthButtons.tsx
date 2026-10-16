import { useEffect, useState } from 'react';

import { AUTH_CANCELLED_MESSAGE, authErrorMessage } from '../../auth/errors';
import { browserProviders, startBroker } from '../../auth/broker';
import { Notice } from '../../components/Notice';
import { config } from '../../config';
import type { OAuthProvider } from '../../lib/env';

const providerLabels: Record<OAuthProvider, string> = {
  vk: 'Продолжить с VK',
  apple: 'Продолжить с Apple',
  google: 'Продолжить с Google',
};

/**
 * Only providers explicitly enabled for the web build
 * (VITE_AUTH_OAUTH_PROVIDERS, and only while web signup is enabled — see
 * config.ts) are rendered, so the page never offers a provider whose web
 * redirect is not configured.
 */
export function OAuthButtons({ nextPath, linking = false }: { nextPath: string; linking?: boolean }) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ready, setReady] = useState({ apple: false, google: false, vk: false });
  useEffect(() => {
    let active = true;
    void browserProviders()
      .then((value) => {
        if (active) setReady(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const providers = config.oauthProviders.filter((provider) => ready[provider]);
  if (!providers.length) return null;

  const start = async (provider: OAuthProvider) => {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      await startBroker(provider, nextPath, linking); // navigates away on success
    } catch (nextError) {
      const message = authErrorMessage(nextError);
      if (message !== AUTH_CANCELLED_MESSAGE) setError(message);
      setBusy(null);
    }
  };

  return (
    <div className="oauth">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`button button-provider button-provider-${provider}`}
          onClick={() => void start(provider)}
          disabled={Boolean(busy)}
        >
          {busy === provider
            ? 'Переходим…'
            : linking
              ? `Подключить ${provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'VK'}`
              : providerLabels[provider]}
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

export function UnavailableProvidersNote() {
  return (
    <p className="form-footnote">
      Доступные способы входа показаны выше. Для входа по почте используйте адрес, подключённый к вашему
      аккаунту.
    </p>
  );
}

/**
 * Age notice and links to the published documents. Registration consent and
 * onboarding acceptance remain a separate release gate, defaulting off.
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
