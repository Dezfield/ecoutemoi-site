import type { Session, User } from '@supabase/supabase-js';

/**
 * Auth statuses — mirrors the mobile app's AuthStatus type.
 * - initializing: session not yet loaded from storage
 * - unauthenticated: no active session
 * - authenticated: session exists, profile check in progress or profile absent
 * - onboarding_required: signed in but dating_profiles.onboarding_complete is false
 * - authenticated_profile_ready: fully onboarded user
 * - password_recovery: user arrived via password reset link
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
  error: string | null;
};

export type AuthContextValue = AuthState & {
  refreshProfileState: () => Promise<void>;
  clearError: () => void;
  signOut: () => Promise<void>;
};
