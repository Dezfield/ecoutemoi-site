import { isValidSupabaseUrl, normalizeBaseUrl, parseOAuthProviders } from './lib/env';

const env = import.meta.env;

const publicSiteUrl = normalizeBaseUrl(env.VITE_PUBLIC_SITE_URL, 'https://ecoutemoi.ru');

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
  oauthProviders: parseOAuthProviders(env.VITE_AUTH_OAUTH_PROVIDERS),
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
