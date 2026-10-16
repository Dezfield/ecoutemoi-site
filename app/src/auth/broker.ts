import { requireSupabase } from '../lib/supabase';
import { config } from '../config';
import { rememberNextPath } from '../lib/redirect';
export type BrokerProvider = 'apple' | 'google' | 'vk';
type Attempt = { provider: BrokerProvider; verifier: string; owner: string | null; expires: number };
const key = 'ecoutemoi.web-broker.attempt';
const functionName = (p: BrokerProvider) => (p === 'vk' ? 'vk-id-auth' : 'oauth-broker');
const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
export async function browserProviders() {
  const client = requireSupabase();
  const [broker, vk] = await Promise.all([
    client.functions.invoke('oauth-broker', { body: { action: 'capabilities' } }),
    client.functions.invoke('vk-id-auth', { body: { action: 'capabilities' } }),
  ]);
  return {
    apple: !broker.error && broker.data?.web?.apple === true,
    google: !broker.error && broker.data?.web?.google === true,
    vk: !vk.error && vk.data?.web?.vk === true,
  };
}
export async function startBroker(provider: BrokerProvider, next: string, linking = false) {
  if (!config.oauthProviders.includes(provider) || !(await browserProviders())[provider])
    throw new Error('Этот способ входа ещё не готов для браузера.');
  const client = requireSupabase();
  const owner = linking ? (await client.auth.getUser()).data.user?.id : null;
  if (linking && !owner) throw new Error('Войдите снова перед подключением способа входа.');
  const verifier = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const attempt: Attempt = { provider, verifier, owner: owner ?? null, expires: Date.now() + 10 * 60000 };
  // Must succeed BEFORE navigating: without this tab's verifier a ticket cannot
  // be redeemed. No session/access/refresh tokens are written here.
  sessionStorage.setItem(key, JSON.stringify(attempt));
  rememberNextPath(next);
  const { data, error } = await client.functions.invoke(functionName(provider), {
    body: {
      action: 'start',
      provider,
      linking,
      returnUri: `${window.location.origin}/auth/broker/callback`,
      clientChallenge: linking ? undefined : await digest(verifier),
    },
  });
  if (error || typeof data?.authorizationUrl !== 'string') {
    sessionStorage.removeItem(key);
    throw new Error('Не удалось начать вход. Повторите позже.');
  }
  const url = new URL(data.authorizationUrl);
  const origins = {
    apple: 'https://appleid.apple.com',
    google: 'https://accounts.google.com',
    vk: 'https://id.vk.com',
  };
  if (url.origin !== origins[provider] || url.username || url.password) {
    sessionStorage.removeItem(key);
    throw new Error('Недопустимый адрес авторизации.');
  }
  window.location.assign(url.toString());
}
export async function finishBroker(href: string) {
  const raw = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!raw) throw new Error('Попытка входа истекла. Начните снова.');
  const attempt = JSON.parse(raw) as Attempt;
  if (
    !['apple', 'google', 'vk'].includes(attempt.provider) ||
    typeof attempt.verifier !== 'string' ||
    !Number.isFinite(attempt.expires) ||
    attempt.expires < Date.now()
  )
    throw new Error('Попытка входа истекла.');
  const params = new URL(href).searchParams;
  if (params.has('error'))
    throw new Error(params.get('error') === 'cancelled' ? 'Вход отменён.' : 'Не удалось подтвердить вход.');
  const client = requireSupabase();
  if (attempt.owner) {
    if ((await client.auth.getUser()).data.user?.id !== attempt.owner)
      throw new Error('Аккаунт изменился. Повторите подключение.');
    const ticket = params.get('link_ticket');
    if (!ticket || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new Error('Некорректный ответ авторизации.');
    const { data, error } = await client.functions.invoke(functionName(attempt.provider), {
      body: { action: 'finalize_link', ticket },
    });
    if (error || data?.linked !== true || (await client.auth.getUser()).data.user?.id !== attempt.owner)
      throw new Error('Подключение не подтверждено.');
    return;
  }
  if (params.has('link_ticket')) throw new Error('Некорректный сценарий входа.');
  const ticket = params.get('ticket');
  if (!ticket || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new Error('Некорректный ответ авторизации.');
  const { data, error } = await client.functions.invoke(functionName(attempt.provider), {
    body: { action: 'finalize', ticket, verifier: attempt.verifier },
  });
  if (error || typeof data?.tokenHash !== 'string')
    throw new Error('Не удалось обменять подтверждение входа.');
  const verified = await client.auth.verifyOtp({ token_hash: data.tokenHash, type: 'magiclink' });
  if (verified.error || !verified.data.session) throw new Error('Не удалось создать сессию.');
}
