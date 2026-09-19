/**
 * Pure helpers for reading build-time configuration. Kept free of
 * `import.meta.env` so they can be unit-tested under Node.
 */

export type OAuthProvider = 'apple' | 'google';

const SUPPORTED_OAUTH_PROVIDERS: readonly OAuthProvider[] = ['apple', 'google'];

/**
 * Parses a comma-separated provider allowlist. Only standard Supabase Auth
 * providers that the web client can start with signInWithOAuth are accepted.
 * VK is excluded: it is not a standard Supabase Auth provider, and
 * ecoutemoi-mobile main contains no VK backend, so web VK sign-in is not
 * implemented (see docs/WEB_BACKEND_MATRIX.md).
 */
export function parseOAuthProviders(raw: string | undefined): OAuthProvider[] {
  if (!raw) return [];
  const requested = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return SUPPORTED_OAUTH_PROVIDERS.filter((provider) => requested.includes(provider));
}

/**
 * Strict opt-in flag: only the literal `true` (any case, surrounding spaces
 * ignored) enables a feature. Empty, missing or any other value keeps it off,
 * so a typo can never enable a feature in production.
 */
export function parseEnabledFlag(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true';
}

/**
 * OAuth providers that may be offered on the sign-in screen. Supabase creates
 * a new auth user on the first OAuth sign-in with an unknown identity and
 * signInWithOAuth has no equivalent of `shouldCreateUser: false`, so any web
 * OAuth button is also a web registration path. OAuth therefore stays hidden
 * while web signup is disabled.
 */
export function enabledOAuthProviders(providers: OAuthProvider[], signupEnabled: boolean): OAuthProvider[] {
  return signupEnabled ? providers : [];
}

/**
 * Normalises an absolute http(s) URL and strips a trailing slash. Returns the
 * fallback for empty or invalid input. Plain `http:` is accepted only for
 * loopback hosts so that a production build cannot silently point to an
 * insecure origin.
 */
export function normalizeBaseUrl(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  if (!value) return fallback;
  try {
    const url = new URL(value);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return fallback;
    if (url.username || url.password || url.search || url.hash) return fallback;
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

/** Validates the Supabase project URL: https, or http on loopback for local stacks. */
export function isValidSupabaseUrl(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  return normalizeBaseUrl(raw, '') !== '';
}
