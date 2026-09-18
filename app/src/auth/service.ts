import type { OAuthProvider } from '../lib/env';
import { rememberNextPath } from '../lib/redirect';
import { requireSupabase } from '../lib/supabase';
import { authCallbackUrl } from '../config';
import type { CallbackParams } from './callback';
import { validateEmail, validatePassword } from './errors';

/**
 * Web equivalents of mobile/src/auth/services/auth.ts. Same Supabase Auth
 * identity model: email one-time codes are the primary email method, OAuth
 * goes through Supabase, and nothing here stores or logs tokens or codes.
 */

/**
 * Sends a one-time email code. `shouldCreateUser` is false for sign-in and
 * true only on the explicit registration screen — the same rule as mobile.
 */
export async function sendEmailCode(email: string, shouldCreateUser: boolean): Promise<string> {
  const normalized = validateEmail(email);
  const { error } = await requireSupabase().auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser, emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw error;
  return normalized;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const normalized = validateEmail(email);
  const token = code.trim();
  if (!/^\d{6,8}$/.test(token)) throw new Error('Введите код из письма.');
  const { data, error } = await requireSupabase().auth.verifyOtp({ email: normalized, token, type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('Не удалось создать сессию. Запросите новый код.');
}

/**
 * Starts browser OAuth through Supabase. The browser leaves the app and
 * comes back to /auth/callback with a PKCE code.
 */
export async function startOAuth(provider: OAuthProvider, nextPath: string): Promise<void> {
  rememberNextPath(nextPath);
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

/** Legacy password recovery — kept only for accounts that still have a password. */
export async function sendPasswordRecovery(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(validateEmail(email), {
    redirectTo: authCallbackUrl(),
  });
  if (error) throw error;
}

export async function setRecoveredPassword(password: string, confirmation: string): Promise<void> {
  validatePassword(password);
  if (password !== confirmation) throw new Error('Пароли не совпадают.');
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export type CallbackResult = { recovery: boolean };

/**
 * Completes an auth callback exactly once. Throws on any failure; the caller
 * maps errors to user-facing text.
 */
export async function completeAuthCallback(params: CallbackParams): Promise<CallbackResult> {
  const client = requireSupabase();
  switch (params.kind) {
    case 'error': {
      const error = new Error(params.description ?? params.code) as Error & { code?: string };
      error.code = params.code;
      throw error;
    }
    case 'implicit_tokens':
      throw new Error('Unsupported implicit-flow callback: invalid state.');
    case 'empty':
      throw new Error('Callback does not contain an authorization code: invalid state.');
    case 'code': {
      // supabase-js reports a password-recovery code through the documented
      // PASSWORD_RECOVERY event, emitted before exchangeCodeForSession resolves.
      let recoveryEvent = false;
      const { data: listener } = client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') recoveryEvent = true;
      });
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(params.code);
        if (error) throw error;
        if (!data.session) throw new Error('Authorization code exchange returned no session.');
      } finally {
        listener.subscription.unsubscribe();
      }
      return { recovery: recoveryEvent || params.typeHint === 'recovery' };
    }
    case 'token_hash': {
      const { data, error } = await client.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type });
      if (error) throw error;
      if (!data.session) throw new Error('Token verification returned no session.');
      return { recovery: params.type === 'recovery' };
    }
  }
}
