import type { ReactNode } from 'react';

import { Notice } from './Notice';
import { Spinner } from './Spinner';

/** Standard loading / error / content switch for account panels. */
export function AsyncState<T>({ loading, error, data, onRetry, loadingLabel, children }: {
  loading: boolean;
  error: string | null;
  data: T | null;
  onRetry: () => void;
  loadingLabel?: string;
  children: (data: T) => ReactNode;
}) {
  if (loading && data === null) {
    return <div className="panel panel-state"><Spinner label={loadingLabel ?? 'Загрузка…'} /></div>;
  }
  if (error && data === null) {
    return (
      <Notice
        tone="error"
        title="Не удалось загрузить данные"
        action={<button type="button" className="button button-secondary button-small" onClick={onRetry}>Повторить</button>}
      >
        <p>{error}</p>
      </Notice>
    );
  }
  if (data === null) return null;
  return <>{children(data)}</>;
}
