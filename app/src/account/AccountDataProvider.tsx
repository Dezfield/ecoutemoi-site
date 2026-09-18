import { createContext, type ReactNode, useContext } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { type AsyncResult, useAsync } from '../lib/useAsync';
import { accountErrorMessage, loadAccountSummary, loadSubscription } from './api';
import type { AccountSummary, StoreSubscription } from './types';

type AccountData = {
  summary: AsyncResult<AccountSummary>;
  subscription: AsyncResult<StoreSubscription>;
};

const AccountDataContext = createContext<AccountData | null>(null);

/**
 * Loads the data shown in the account header and overview once per signed-in
 * user. Section pages load their own data on demand.
 */
export function AccountDataProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const userId = user?.id ?? '';
  const email = user?.email ?? null;
  const profileState = status;
  const summary = useAsync(
    () => loadAccountSummary(userId, email),
    accountErrorMessage,
    [userId, email, profileState],
  );
  const subscription = useAsync(loadSubscription, accountErrorMessage, [userId]);
  return <AccountDataContext.Provider value={{ summary, subscription }}>{children}</AccountDataContext.Provider>;
}

export function useAccountData(): AccountData {
  const value = useContext(AccountDataContext);
  if (!value) throw new Error('useAccountData must be used inside AccountDataProvider.');
  return value;
}
