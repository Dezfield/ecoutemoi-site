/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_TERMS_URL?: string;
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_AUTH_OAUTH_PROVIDERS?: string;
  readonly VITE_AUTH_SIGNUP_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
