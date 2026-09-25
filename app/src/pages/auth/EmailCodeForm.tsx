import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import { userFacingAuthError } from '../../auth/errors';
import { sendEmailCode, verifyEmailCode } from '../../auth/service';
import { Notice } from '../../components/Notice';

const RESEND_SECONDS = 60;

/**
 * Email one-time-code sign-in / registration (Supabase signInWithOtp +
 * verifyOtp, the email mechanism mobile main also uses); no password is asked
 * for. `signup` allows Supabase to create the auth user and is rendered only
 * when web signup is enabled; `login` never creates a user.
 */
export function EmailCodeForm({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const emailId = useId();
  const codeId = useId();
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (sentTo) codeRef.current?.focus();
  }, [sentTo]);

  const requestCode = async () => {
    const normalized = await sendEmailCode(email, mode === 'signup');
    setEmail(normalized);
    setSentTo(normalized);
    setCode('');
    setResendIn(RESEND_SECONDS);
    setNotice(`Код отправлен на ${normalized}.`);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!sentTo) {
        await requestCode();
      } else {
        // On success supabase-js emits SIGNED_IN; the route guard then moves
        // the visitor to the requested private page.
        await verifyEmailCode(sentTo, code);
      }
    } catch (nextError) {
      setError(userFacingAuthError(nextError));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || resendIn > 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestCode();
    } catch (nextError) {
      setError(userFacingAuthError(nextError));
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = () => {
    setSentTo(null);
    setCode('');
    setError(null);
    setNotice(null);
    setResendIn(0);
    window.setTimeout(() => emailRef.current?.focus(), 0);
  };

  return (
    <form className="form" onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}>
      <p id={hintId} className="form-hint">
        {sentTo
          ? `Введите одноразовый код из письма, отправленного на ${sentTo}.`
          : 'Мы отправим одноразовый код на вашу почту. Пароль не нужен.'}
      </p>
      <div className="field">
        <label htmlFor={emailId}>Email</label>
        <input
          ref={emailRef}
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          readOnly={Boolean(sentTo)}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={Boolean(error) && !sentTo}
        />
      </div>
      {sentTo ? (
        <div className="field">
          <label htmlFor={codeId}>Код из письма</label>
          <input
            ref={codeRef}
            id={codeId}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            required
            className="input-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
          />
        </div>
      ) : null}
      <button type="submit" className="button button-primary button-block" disabled={busy}>
        {busy ? 'Подождите…' : sentTo ? 'Подтвердить код' : 'Получить код'}
      </button>
      {error ? <div id={errorId}><Notice tone="error">{error}</Notice></div> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {sentTo ? (
        <div className="form-links">
          <button type="button" className="text-button" onClick={() => void resend()} disabled={busy || resendIn > 0}>
            {resendIn > 0 ? `Отправить код повторно через ${resendIn} сек.` : 'Отправить код повторно'}
          </button>
          <button type="button" className="text-button" onClick={changeEmail} disabled={busy}>
            Изменить email
          </button>
        </div>
      ) : null}
    </form>
  );
}
