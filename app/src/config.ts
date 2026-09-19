import {
  enabledOAuthProviders,
  isValidSupabaseUrl,
  normalizeBaseUrl,
  parseEnabledFlag,
  parseOAuthProviders,
} from './lib/env';

const env = import.meta.env;

const publicSiteUrl = normalizeBaseUrl(env.VITE_PUBLIC_SITE_URL, 'https://ecoutemoi.ru');

/**
 * Web registration is off unless explicitly enabled. It must stay off for
 * public production until the release blockers in docs/WEB_APP_DEPLOYMENT.md
 * (approved Terms and Privacy Policy, product-approved 18+ flow, testing
 * against the real Supabase project) are resolved. Sign-in of existing
 * accounts does not depend on this flag.
 */
const signupEnabled = parseEnabledFlag(env.VITE_AUTH_SIGNUP_ENABLED);

/**
 * Build-time configuration of the web app. Every VITE_* value is embedded in
 * the public bundle: only the Supabase project URL and the publishable
 * (anon) key belong here — never a service_role key or provider secret.
 */
export const config = {
  supabaseUrl: env.VITE_SUPABASE_URL?.trim() ?? '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
  supabaseConfigured:
    isValidSupabaseUrl(env.VITE_SUPABASE_URL) && Boolean(env.VITE_SUPABASE_ANON_KEY?.trim()),
  signupEnabled,
  oauthProviders: enabledOAuthProviders(parseOAuthProviders(env.VITE_AUTH_OAUTH_PROVIDERS), signupEnabled),
  publicSiteUrl,
  links: {
    home: `${publicSiteUrl}/`,
    howItWorks: `${publicSiteUrl}/#how`,
    faq: `${publicSiteUrl}/#faq`,
    privacy: normalizeBaseUrl(env.VITE_PRIVACY_URL, `${publicSiteUrl}/privacy`) + '/',
    terms: normalizeBaseUrl(env.VITE_TERMS_URL, `${publicSiteUrl}/terms`) + '/',
    community: `${publicSiteUrl}/community/`,
    accountDeletion: `${publicSiteUrl}/account-deletion/`,
    support: `${publicSiteUrl}/support/`,
  },
} as const;

/** Callback route used by OAuth, email links and password recovery. */
export function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}
