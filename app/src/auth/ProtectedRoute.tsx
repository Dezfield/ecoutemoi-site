import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { LoadingScreen } from '../components/LoadingScreen';
import { safeInternalPath } from '../lib/redirect';
import { useAuth } from './AuthProvider';

/**
 * Guards private routes. This is a UX guard only: every private query is
 * also authorised server-side by RLS/RPC checks against the session JWT.
 *
 * - initializing → loader, so private UI never flashes before the session is known
 * - unauthenticated → /login, remembering the intended internal destination
 * - password_recovery → the recovery session must set a new password first
 * - authenticated without a finished profile check → loader
 * - otherwise (onboarding required, profile ready, or profile check failed)
 *   → the account shell, which shows the matching banner
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, profileError } = useAuth();
  const location = useLocation();

  if (status === 'initializing') return <LoadingScreen />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (status === 'password_recovery') return <Navigate to="/auth/reset-password" replace />;
  if (status === 'authenticated' && !profileError) return <LoadingScreen label="Проверяем профиль…" />;
  return <>{children}</>;
}

/** For /login and /signup: a signed-in visitor goes straight to the account. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'initializing') return <LoadingScreen label="Проверяем вход…" />;
  if (status === 'password_recovery') return <Navigate to="/auth/reset-password" replace />;
  if (status !== 'unauthenticated') {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeInternalPath(from)} replace />;
  }
  return <>{children}</>;
}
