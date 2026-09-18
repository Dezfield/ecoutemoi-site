import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export type AsyncResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (next: T | null) => void;
};

/**
 * Loads data for a panel, ignoring results that arrive after unmount or
 * after a newer request. `toMessage` converts errors to user-facing text so
 * raw server messages are never rendered.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  toMessage: (error: unknown) => string,
  deps: DependencyList,
): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  const messageRef = useRef(toMessage);
  loaderRef.current = loader;
  messageRef.current = toMessage;

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    loaderRef.current()
      .then((result) => {
        if (current) setData(result);
      })
      .catch((nextError: unknown) => {
        if (current) setError(messageRef.current(nextError));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [version, ...deps]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}
