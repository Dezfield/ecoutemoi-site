import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Parsing of the /auth/callback URL. Pure so it can be unit-tested.
 *
 * Supported inputs (PKCE project):
 * - `?code=…` — OAuth or email-link code, exchanged with the verifier that
 *   this browser stored when the flow started;
 * - `?token_hash=…&type=…` — email template links (Supabase `{{ .TokenHash }}`),
 *   verified server-side; they also work when opened in another browser;
 * - `?error=…&error_description=…` (query or fragment) — provider/server errors.
 *
 * Tokens in the URL fragment (implicit flow) are rejected: this client never
 * requests them, so their presence means a misconfigured template or an
 * injected link.
 */

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

export type CallbackParams =
  | { kind: 'error'; code: string; description: string | null }
  | { kind: 'code'; code: string; typeHint: string | null }
  | { kind: 'token_hash'; tokenHash: string; type: EmailOtpType }
  | { kind: 'implicit_tokens' }
  | { kind: 'empty' };

export function parseCallbackUrl(href: string): CallbackParams {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: 'empty' };
  }
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const read = (name: string) => query.get(name) ?? fragment.get(name);

  const error = read('error') ?? read('error_code');
  const description = read('error_description');
  if (error || description) {
    return { kind: 'error', code: (error ?? 'unknown_error').slice(0, 100), description: description?.slice(0, 300) ?? null };
  }

  if (fragment.get('access_token') || fragment.get('refresh_token') || query.get('access_token')) {
    return { kind: 'implicit_tokens' };
  }

  const code = query.get('code');
  if (code && /^[A-Za-z0-9._~-]{8,512}$/.test(code)) {
    return { kind: 'code', code, typeHint: query.get('type') };
  }

  const tokenHash = query.get('token_hash');
  const type = query.get('type');
  if (tokenHash && type && /^[A-Za-z0-9._~-]{8,512}$/.test(tokenHash)) {
    const known = EMAIL_OTP_TYPES.find((candidate) => candidate === type);
    if (known) return { kind: 'token_hash', tokenHash, type: known };
  }

  return { kind: 'empty' };
}
