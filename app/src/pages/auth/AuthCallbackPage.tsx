import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '../../auth/AuthProvider';
import { parseCallbackUrl } from '../../auth/callback';
import { AUTH_CANCELLED_MESSAGE, authErrorMessage } from '../../auth/errors';
import { type CallbackResult, completeAuthCallback } from '../../auth/service';
import { Notice } from '../../components/Notice';
import { Spinner } from '../../components/Spinner';
import { config } from '../../config';
import { AuthLayout } from '../../layouts/AuthLayout';
import { consumeNextPath } from '../../lib/redirect';
import { requireSupabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../lib/useDocumentTitle';

/**
 * One exchange per callback URL, shared between StrictMode's double effect
 * invocation. The code is single-use on the server as well.
 */
const inflight = new Map<string, Promise<CallbackResult>>();

export function AuthCallbackPage() {
  useDocumentTitle('Вход');
  const navigate = useNavigate();
  const { markPasswordRecovery, refreshProfileState } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Captured during the first render, before the effect cleans the address bar.
  const [initialHref] = useState(() => window.location.href);

  useEffect(() => {
    if (!config.supabaseConfigured) {
      setError('Сервис входа не настроен для этой сборки сайта.');
      return undefined;
    }
    let active = true;
    const href = initialHref;
    const params = parseCallbackUrl(href);
    // Remove the one-time code / token hash from the address bar and history.
    window.history.replaceState(window.history.state, '', '/auth/callback');

    let task = inflight.get(href);
    if (!task) {
      task =
        params.kind === 'empty'
          ? // A reload of an already completed callback: continue only if a session exists.
            requireSupabase()
              .auth.getSession()
              .then(({ data }) => {
                if (!data.session) return completeAuthCallback(params);
                return { recovery: false };
              })
          : completeAuthCallback(params);
      inflight.set(href, task);
    }

    task
      .then(async (result) => {
        if (result.recovery) markPasswordRecovery();
        await refreshProfileState();
        if (!active) return;
        navigate(result.recovery ? '/auth/reset-password' : consumeNextPath(), { replace: true });
      })
      .catch((nextError: unknown) => {
        if (!active) return;
        consumeNextPath();
        setError(authErrorMessage(nextError));
      });

    return () => {
      active = false;
    };
  }, [initialHref, markPasswordRecovery, navigate, refreshProfileState]);

  if (!error) {
    return (
      <AuthLayout>
        <h1 className="auth-title">Завершаем вход</h1>
        <div className="panel-state"><Spinner label="Проверяем данные входа…" /></div>
      </AuthLayout>
    );
  }

  const cancelled = error === AUTH_CANCELLED_MESSAGE;
  return (
    <AuthLayout>
      <h1 className="auth-title">{cancelled ? 'Вход отменён' : 'Не удалось войти'}</h1>
      <Notice tone={cancelled ? 'info' : 'error'}>{cancelled ? 'Вы можете выбрать другой способ входа.' : error}</Notice>
      <div className="auth-links">
        <p><Link to="/login" className="button button-primary button-block">Вернуться ко входу</Link></p>
      </div>
    </AuthLayout>
  );
}
