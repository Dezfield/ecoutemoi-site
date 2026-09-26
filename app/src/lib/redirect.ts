/**
 * Post-login redirect handling. Only same-origin application paths are ever
 * accepted, so a crafted `next` value cannot turn the login or OAuth callback
 * into an open redirect.
 */

export const DEFAULT_AFTER_LOGIN = '/voices';

const ALLOWED_PREFIXES = ['/account', '/profile', '/voices', '/resonances', '/chats'];

/**
 * Returns a safe internal path or the default. Rejects absolute URLs,
 * protocol-relative URLs (`//evil.example`), backslash tricks, control
 * characters and anything outside the private area of the app.
 */
export function safeInternalPath(candidate: unknown, fallback = DEFAULT_AFTER_LOGIN): string {
  if (typeof candidate !== 'string') return fallback;
  const value = candidate.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(value, 'https://app.invalid');
  } catch {
    return fallback;
  }
  if (parsed.origin !== 'https://app.invalid') return fallback;
  const path = parsed.pathname;
  const allowed = ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!allowed) return fallback;
  return `${path}${parsed.search}${parsed.hash}`;
}

const NEXT_STORAGE_KEY = 'ecoutemoi.auth.next';

/**
 * Remembers where to return after an OAuth round-trip. Stored in
 * sessionStorage (per tab) rather than in the provider redirect URL so the
 * Supabase redirect allowlist can stay an exact `/auth/callback` entry.
 */
export function rememberNextPath(path: string, storage: Storage | undefined = globalThis.sessionStorage) {
  try {
    storage?.setItem(NEXT_STORAGE_KEY, safeInternalPath(path));
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The
    // default destination is used instead.
  }
}

export function consumeNextPath(storage: Storage | undefined = globalThis.sessionStorage): string {
  try {
    const value = storage?.getItem(NEXT_STORAGE_KEY);
    storage?.removeItem(NEXT_STORAGE_KEY);
    return safeInternalPath(value);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
}
