import type { Session, User } from '@supabase/supabase-js';

/**
 * Auth statuses — mirrors the mobile app's AuthStatus type.
 * - initializing: session not yet loaded from storage
 * - unauthenticated: no active session
 * - authenticated: session exists; the profile check is in progress or failed
 *   (see `profileError`)
 * - onboarding_required: signed in, but dating_profiles.onboarding_complete is false
 *   or the dating profile does not exist yet
 * - authenticated_profile_ready: fully onboarded user
 * - password_recovery: user arrived via a password recovery link
 */
export type AuthStatus =
  | 'initializing'
  | 'unauthenticated'
  | 'authenticated'
  | 'onboarding_required'
  | 'authenticated_profile_ready'
  | 'password_recovery';

export type LoginProvider = 'apple' | 'google' | 'vk' | 'email';

export type LoginMethod = {
  provider: LoginProvider;
  connected: boolean;
  identityId: string | null;
  label: string | null;
};

export type AccountSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
};

export type AuthState = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Session could not be restored (storage/network). */
  error: string | null;
  /** Signed in, but the profile status could not be loaded. */
  profileError: string | null;
  /** One-time message for the sign-in screen (e.g. after an explicit sign-out). */
  notice: string | null;
};

export type AuthContextValue = AuthState & {
  refreshProfileState: () => Promise<void>;
  markPasswordRecovery: () => void;
  completePasswordRecovery: () => Promise<void>;
  clearError: () => void;
  signOut: (notice?: string) => Promise<void>;
};
