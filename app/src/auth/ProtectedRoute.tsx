import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { OnboardingRequired } from '../components/ui/OnboardingRequired';

/**
 * Guards private routes.
 *
 * - initializing   → shows full-screen loader (prevents flash of private content)
 * - unauthenticated → redirects to /login, preserving the intended destination
 * - onboarding_required → shows "Complete in app" screen (not a full redirect,
 *   so the user can still see the account shell and sign out)
 * - password_recovery → allowed through (user needs to set a new password)
 * - authenticated / authenticated_profile_ready → renders children
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <LoadingScreen />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (status === 'onboarding_required') {
    return <OnboardingRequired />;
  }

  return <>{children}</>;
}
