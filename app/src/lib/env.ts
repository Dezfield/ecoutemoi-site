/**
 * Pure helpers for reading build-time configuration. Kept free of
 * `import.meta.env` so they can be unit-tested under Node.
 */

export type OAuthProvider = 'apple' | 'google';

const SUPPORTED_OAUTH_PROVIDERS: readonly OAuthProvider[] = ['apple', 'google'];

/**
 * Parses a comma-separated provider allowlist. Only providers that the web
 * client can actually run are accepted. VK is intentionally excluded: the
 * `vk-id-auth` Edge Function currently accepts only the mobile
 * `ecoutemoi://auth/vk` return URI.
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
