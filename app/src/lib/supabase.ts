import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config';

/**
 * The single Supabase client of the web app. It talks to the same Supabase
 * project as the iOS/Android app, so a person signs in to the same
 * `auth.users` identity and the same `profiles` / `dating_profiles` rows.
 *
 * - Only the publishable (anon) key is used — never service_role. Every
 *   query runs as the signed-in user and is subject to the existing RLS
 *   policies and SECURITY DEFINER RPC checks.
 * - PKCE flow: OAuth and email links return a one-time `?code=` that is
 *   exchanged together with the verifier stored in this browser.
 * - `detectSessionInUrl` is disabled on purpose. The code exchange happens
 *   exactly once, explicitly, on /auth/callback (see auth/callback.ts), so
 *   no other route can consume or leak a code and every failure can be shown
 *   to the user instead of being swallowed during client initialisation.
 */
export const supabase: SupabaseClient | null = config.supabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export const cloudEnabled = supabase !== null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в app/.env.local.',
    );
  }
  return supabase;
}
