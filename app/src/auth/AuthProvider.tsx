import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cloudEnabled, requireSupabase } from '../lib/supabase';
import { authErrorMessage } from './errors';
import type { AuthContextValue, AuthState, AuthStatus } from './types';

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  status: 'initializing',
  session: null,
  user: null,
  error: null,
};

/**
 * Web AuthProvider — mirrors mobile/src/auth/hooks/useAuth.tsx logic but uses
 * browser APIs (window.location) instead of expo-linking.
 *
 * Profile classification:
 *  - checks `profiles` table for user record
 *  - checks `dating_profiles.onboarding_complete` for onboarding status
 * This mirrors the exact logic of the mobile AuthProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);
  const sessionRef = useRef<Session | null>(null);
  const recoveryRef = useRef(false);

  const classifySession = useCallback(
    async (session: Session | null, recovery = false) => {
      sessionRef.current = session;
      if (!session) {
        setState({ status: 'unauthenticated', session: null, user: null, error: null });
        return;
      }
      if (recovery) {
        setState({ status: 'password_recovery', session, user: session.user, error: null });
        return;
      }

      // Optimistic update while we fetch profile info
      setState((current) => ({
        status:
          current.user?.id === session.user.id &&
          (current.status === 'onboarding_required' ||
            current.status === 'authenticated_profile_ready')
            ? current.status
            : 'authenticated',
        session,
        user: session.user,
        error: null,
      }));

      // Check profiles and dating_profiles — same logic as mobile
      const [profileResult, datingResult] = await Promise.all([
        requireSupabase()
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle(),
        requireSupabase()
          .from('dating_profiles')
          .select('onboarding_complete')
          .eq('user_id', session.user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (datingResult.error) throw datingResult.error;

      const nextStatus: AuthStatus = datingResult.data?.onboarding_complete
        ? 'authenticated_profile_ready'
        : 'onboarding_required';

      setState({ status: nextStatus, session, user: session.user, error: null });
    },
    [],
  );

  const refreshProfileState = useCallback(async () => {
    recoveryRef.current = false;
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    await classifySession(data.session);
  }, [classifySession]);

  const signOut = useCallback(async () => {
    const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
    if (error) throw error;
    sessionRef.current = null;
    setState({ status: 'unauthenticated', session: null, user: null, error: null });
  }, []);

  useEffect(() => {
    if (!cloudEnabled) {
      setState({
        status: 'unauthenticated',
        session: null,
        user: null,
        error: 'Supabase не настроен.',
      });
      return undefined;
    }

    let active = true;

    const initialize = async () => {
      try {
        // Check if this is a password recovery URL
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
        const type = url.searchParams.get('type') ?? fragment.get('type');
        if (type === 'recovery') {
          recoveryRef.current = true;
        }

        const { data, error } = await requireSupabase().auth.getSession();
        if (error) throw error;
        if (active) await classifySession(data.session, recoveryRef.current);
      } catch (error) {
        if (active) {
          setState({
            status: 'unauthenticated',
            session: null,
            user: null,
            error: authErrorMessage(error),
          });
        }
      }
    };

    void initialize();

    const { data: authSubscription } = requireSupabase().auth.onAuthStateChange(
      (event, session) => {
        // Use setTimeout(0) to avoid state update collision with concurrent Supabase calls
        setTimeout(() => {
          if (!active) return;
          if (event === 'PASSWORD_RECOVERY' || recoveryRef.current) {
            recoveryRef.current = true;
            void classifySession(session, true);
          } else if (event === 'SIGNED_OUT') {
            void classifySession(null);
          } else if (
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED'
          ) {
            void classifySession(session).catch((error: unknown) => {
              if (active) {
                setState((current) => ({ ...current, error: authErrorMessage(error) }));
              }
            });
          }
        }, 0);
      },
    );

    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [classifySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refreshProfileState,
      clearError: () => setState((current) => ({ ...current, error: null })),
      signOut,
    }),
    [refreshProfileState, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
