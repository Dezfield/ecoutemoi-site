import { Navigate, Route, Routes } from 'react-router';

import { AccountDataProvider } from './account/AccountDataProvider';
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute';
import { AccountLayout } from './layouts/AccountLayout';
import { AccountDeletedPage } from './pages/AccountDeletedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BlockedPage } from './pages/account/BlockedPage';
import { DeleteAccountPage } from './pages/account/DeleteAccountPage';
import { LegalPage } from './pages/account/LegalPage';
import { NotificationsPage } from './pages/account/NotificationsPage';
import { OverviewPage } from './pages/account/OverviewPage';
import { PrivacyPage } from './pages/account/PrivacyPage';
import { ProfilePage } from './pages/account/ProfilePage';
import { SecurityPage } from './pages/account/SecurityPage';
import { SettingsPage } from './pages/account/SettingsPage';
import { SubscriptionPage } from './pages/account/SubscriptionPage';
import { SupportPage } from './pages/account/SupportPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { VoicesPage } from './pages/product/VoicesPage';
import { RecordVoicePage } from './pages/product/RecordVoicePage';
import { ResonancesPage } from './pages/product/ResonancesPage';
import { ChatsPage } from './pages/product/ChatsPage';
import { ChatPage } from './pages/product/ChatPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { SignupPage } from './pages/auth/SignupPage';

/**
 * Route map of app.ecoutemoi.ru. Public auth routes, the OAuth/email
 * callback, and the shared private product/account shell.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/voices" replace />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/account-deleted" element={<AccountDeletedPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AccountDataProvider>
              <AccountLayout />
            </AccountDataProvider>
          </ProtectedRoute>
        }
      >
        <Route path="voices" element={<VoicesPage />} />
        <Route path="voices/record" element={<RecordVoicePage />} />
        <Route path="resonances" element={<ResonancesPage />} />
        <Route path="chats" element={<ChatsPage />} />
        <Route path="chats/:conversationId" element={<ChatPage />} />
        <Route path="profile" element={<Navigate to="/account" replace />} />
        <Route path="account" element={<OverviewPage />} />
        <Route path="account/profile" element={<ProfilePage />} />
        <Route path="account/settings" element={<SettingsPage />} />
        <Route path="account/privacy" element={<PrivacyPage />} />
        <Route path="account/notifications" element={<NotificationsPage />} />
        <Route path="account/subscription" element={<SubscriptionPage />} />
        <Route path="account/security" element={<SecurityPage />} />
        <Route path="account/blocked" element={<BlockedPage />} />
        <Route path="account/support" element={<SupportPage />} />
        <Route path="account/legal" element={<LegalPage />} />
        <Route path="account/delete" element={<DeleteAccountPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
