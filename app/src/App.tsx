import { Navigate, Route, Routes } from 'react-router';

import { AccountDataProvider } from './account/AccountDataProvider';
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute';
import { AccountLayout } from './layouts/AccountLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { BlockedPage } from './pages/account/BlockedPage';
import { DeleteAccountPage } from './pages/account/DeleteAccountPage';
import { LegalPage } from './pages/account/LegalPage';
import { NotificationsPage } from './pages/account/NotificationsPage';
import { PaymentResultPage } from './pages/account/PaymentResultPage';
import { OverviewPage } from './pages/account/OverviewPage';
import { PrivacyPage } from './pages/account/PrivacyPage';
import { ProfilePage } from './pages/account/ProfilePage';
import { SecurityPage } from './pages/account/SecurityPage';
import { SettingsPage } from './pages/account/SettingsPage';
import { SubscriptionPage } from './pages/account/SubscriptionPage';
import { SupportPage } from './pages/account/SupportPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { SignupPage } from './pages/auth/SignupPage';

/**
 * Route map of app.ecoutemoi.ru. Public auth routes, the OAuth/email
 * callback, and the private /account area. Future product areas (voices,
 * resonances, chats) get their own top-level private routes next to /account.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/account" replace />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountDataProvider>
              <AccountLayout />
            </AccountDataProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        {/* Return URL of the payment provider. It only reads the backend status. */}
        <Route path="subscription/payment" element={<PaymentResultPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="blocked" element={<BlockedPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="delete" element={<DeleteAccountPage />} />
        <Route path="*" element={<Navigate to="/account" replace />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
