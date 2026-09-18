import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
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
import { authErrorMessage, NETWORK_ERROR_MESSAGE } from './errors';
import type { AuthContextValue, AuthState, AuthStatus } from './types';

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  status: 'initializing',
  session: null,
  user: null,
  error: null,
  profileError: null,
  notice: null,
};

const signedOutState: AuthState = {
  status: 'unauthenticated',
  session: null,
  user: null,
  error: null,
  profileError: null,
  notice: null,
};

/**
 * A recovery session must end on the "set a new password" screen, also after
 * a page reload. The flag lives in sessionStorage (this tab only) and holds no
 * secret — the session itself stays in supabase-js storage.
 */
const RECOVERY_FLAG = 'ecoutemoi.auth.recovery';

function readRecoveryFlag(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(RECOVERY_FLAG) === '1';
  } catch {
    return false;
  }
}

function writeRecoveryFlag(active: boolean) {
  try {
    if (active) globalThis.sessionStorage?.setItem(RECOVERY_FLAG, '1');
    else globalThis.sessionStorage?.removeItem(RECOVERY_FLAG);
  } catch {
    // Storage unavailable: recovery still works for the current page view.
  }
}

const classifiedStatuses: AuthStatus[] = ['onboarding_required', 'authenticated_profile_ready'];

/**
 * Web AuthProvider. Mirrors mobile/src/auth/hooks/useAuth.tsx:
 * - the same status model;
 * - the same profile classification (`profiles` row + `dating_profiles.onboarding_complete`),
 *   read as the signed-in user under RLS (only own rows are visible).
 *
 * Web-specific differences:
 * - OAuth/email-link callbacks are completed on /auth/callback, not here;
 * - a failed profile check keeps the session and exposes `profileError`
 *   instead of pretending the user is signed out;
 * - token refreshes update the session without re-querying the profile.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);
  const stateRef = useRef<AuthState>(initialState);
  const recoveryRef = useRef(false);
  const classificationRun = useRef(0);

  const commit = useCallback((next: AuthState | ((current: AuthState) => AuthState)) => {
    setState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      stateRef.current = resolved;
      return resolved;
    });
  }, []);

  const classifySession = useCallback(
    async (session: Session | null, recovery: boolean) => {
      const run = ++classificationRun.current;
      if (!session) {
        recoveryRef.current = false;
        writeRecoveryFlag(false);
        commit((current) => ({ ...signedOutState, notice: current.status === 'unauthenticated' ? current.notice : null }));
        return;
      }
      if (recovery) {
        recoveryRef.current = true;
        writeRecoveryFlag(true);
        commit({ status: 'password_recovery', session, user: session.user, error: null, profileError: null, notice: null });
        return;
      }

      commit((current) => ({
        status:
          current.user?.id === session.user.id && classifiedStatuses.includes(current.status)
            ? current.status
            : 'authenticated',
        session,
        user: session.user,
        error: null,
        profileError: null,
        notice: null,
      }));

      try {
        const client = requireSupabase();
        const [profileResult, datingResult] = await Promise.all([
          client.from('profiles').select('id').eq('id', session.user.id).maybeSingle(),
          client
            .from('dating_profiles')
            .select('onboarding_complete')
            .eq('user_id', session.user.id)
            .maybeSingle(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (datingResult.error) throw datingResult.error;
        if (run !== classificationRun.current) return;
        commit({
          status: datingResult.data?.onboarding_complete ? 'authenticated_profile_ready' : 'onboarding_required',
          session,
          user: session.user,
          error: null,
          profileError: null,
          notice: null,
        });
      } catch (error) {
        if (run !== classificationRun.current) return;
        const offline = authErrorMessage(error) === NETWORK_ERROR_MESSAGE;
        commit((current) => ({
          ...current,
          status: 'authenticated',
          profileError: offline ? NETWORK_ERROR_MESSAGE : 'Не удалось загрузить данные профиля. Попробуйте ещё раз.',
        }));
      }
    },
    [commit],
  );

  const refreshProfileState = useCallback(async () => {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    await classifySession(data.session, recoveryRef.current);
  }, [classifySession]);

  const markPasswordRecovery = useCallback(() => {
    recoveryRef.current = true;
    writeRecoveryFlag(true);
  }, []);

  const completePasswordRecovery = useCallback(async () => {
    recoveryRef.current = false;
    writeRecoveryFlag(false);
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    await classifySession(data.session, false);
  }, [classifySession]);

  const signOut = useCallback(async (notice?: string) => {
    // scope 'local' — same as mobile: ends this browser's session only.
    // supabase-js removes the local session even if the network call fails,
    // so the UI always returns to the signed-out state.
    const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
    if (error) {
      const { data } = await requireSupabase().auth.getSession();
      if (data.session) throw error; // still signed in locally: keep the UI consistent
    }
    classificationRun.current += 1;
    recoveryRef.current = false;
    writeRecoveryFlag(false);
    commit({ ...signedOutState, notice: notice ?? null });
  }, [commit]);

  useEffect(() => {
    if (!cloudEnabled) {
      commit({ ...signedOutState, error: 'Сервис входа не настроен.' });
      return undefined;
    }

    let active = true;
    recoveryRef.current = readRecoveryFlag();

    const initialize = async () => {
      try {
        const { data, error } = await requireSupabase().auth.getSession();
        if (error) throw error;
        if (active) await classifySession(data.session, recoveryRef.current && Boolean(data.session));
      } catch (error) {
        if (active) commit({ ...signedOutState, error: authErrorMessage(error) });
      }
    };
    void initialize();

    const handleEvent = (event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      const current = stateRef.current;
      if (event === 'INITIAL_SESSION') return; // handled by initialize()
      if (event === 'SIGNED_OUT' || !session) {
        void classifySession(null, false);
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        void classifySession(session, true);
        return;
      }
      const sameUser = current.user?.id === session.user.id;
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (sameUser) {
          commit((latest) => ({ ...latest, session, user: session.user }));
          return;
        }
      }
      // SIGNED_IN also fires when a tab regains focus; only re-check the
      // profile when the user changed or the previous check did not succeed.
      const settled = sameUser && (classifiedStatuses.includes(current.status) || current.status === 'password_recovery');
      if (settled && !current.profileError) {
        commit((latest) => ({ ...latest, session, user: session.user }));
        return;
      }
      void classifySession(session, recoveryRef.current);
    };

    const { data: subscription } = requireSupabase().auth.onAuthStateChange((event, session) => {
      // Defer so no Supabase call runs inside the auth-state callback.
      setTimeout(() => handleEvent(event, session), 0);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [classifySession, commit]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refreshProfileState,
      markPasswordRecovery,
      completePasswordRecovery,
      clearError: () => commit((current) => ({ ...current, error: null, notice: null })),
      signOut,
    }),
    [commit, completePasswordRecovery, markPasswordRecovery, refreshProfileState, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
