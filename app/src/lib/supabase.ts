import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(supabaseUrl?.trim() && supabaseAnonKey?.trim());

/**
 * Supabase web client.
 * Uses PKCE flow so that OAuth callbacks exchange a code for a session
 * rather than receiving tokens directly in the URL fragment.
 * detectSessionInUrl: true is required so the client picks up the ?code=
 * query param after an OAuth redirect.
 *
 * Only the publishable (anon) key is used here — never service_role.
 */
export const supabase = cloudEnabled
  ? createClient(supabaseUrl!.trim(), supabaseAnonKey!.trim(), {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в app/.env.',
    );
  }
  return supabase;
}
