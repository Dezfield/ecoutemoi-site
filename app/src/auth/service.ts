import type { OAuthProvider } from '../lib/env';
import { rememberNextPath } from '../lib/redirect';
import { requireSupabase } from '../lib/supabase';
import { authCallbackUrl, config } from '../config';
import type { CallbackParams } from './callback';
import { SIGNUP_DISABLED_MESSAGE, validateEmail, validatePassword } from './errors';

/**
 * Supabase Auth calls of the web app. The email one-time code is the same
 * Supabase Auth mechanism the mobile app uses (mobile main
 * src/services/cloudChat.ts: sendCloudEmailOtp / verifyCloudEmailOtp).
 * Nothing here stores or logs tokens or codes.
 */

/**
 * Sends a one-time email code. The sign-in screen always passes
 * `shouldCreateUser: false`, so it never creates an account (mobile main
 * sign-in passes true). `true` is accepted only from the registration screen
 * and only when web signup is enabled for this build.
 */
export async function sendEmailCode(email: string, shouldCreateUser: boolean): Promise<string> {
  if (shouldCreateUser && !config.signupEnabled) throw new Error(SIGNUP_DISABLED_MESSAGE);
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
 * comes back to /auth/callback with a PKCE code. Only providers enabled for
 * this build are accepted (none while web signup is disabled, see config.ts).
 */
export async function startOAuth(provider: OAuthProvider, nextPath: string): Promise<void> {
  if (!config.oauthProviders.includes(provider)) throw new Error('provider is not enabled');
  rememberNextPath(nextPath);
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

/**
 * Supabase Auth password recovery for an account that has a password. Mobile
 * main has no password sign-in and the web has none either, so this flow is
 * not linked from the sign-in screen; it is kept so that a recovery link is
 * completed safely (the session must set a new password first).
 */
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
