import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { finishBroker } from '../../auth/broker';
import { useAuth } from '../../auth/AuthProvider';
import { consumeNextPath } from '../../lib/redirect';
import { AuthLayout } from '../../layouts/AuthLayout';
const attempts = new Map<string, Promise<void>>();
export function BrokerCallbackPage() {
  const [href] = useState(() => window.location.href);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { refreshProfileState } = useAuth();
  useEffect(() => {
    let active = true;
    window.history.replaceState(window.history.state, '', '/auth/broker/callback');
    let task = attempts.get(href);
    if (!task) {
      task = finishBroker(href);
      attempts.set(href, task);
    }
    void task
      .then(async () => {
        await refreshProfileState();
        if (active) navigate(consumeNextPath(), { replace: true });
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Вход не завершён.');
      });
    return () => {
      active = false;
    };
  }, [href, navigate, refreshProfileState]);
  return (
    <AuthLayout>
      <h1>{error ? 'Вход не завершён' : 'Подтверждаем вход'}</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Link to="/login">Вернуться ко входу</Link>
        </>
      ) : (
        <p role="status">Проверяем подтверждение провайдера…</p>
      )}
    </AuthLayout>
  );
}
