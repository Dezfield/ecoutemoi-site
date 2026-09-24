/**
 * Auth error messages of the web app. Supabase Auth errors are mapped to
 * neutral Russian text; raw provider/server messages are never shown.
 */

const includesAny = (value: string, parts: string[]) => parts.some((part) => value.includes(part));

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error ?? '');
}

export const AUTH_CANCELLED_MESSAGE = 'Вход отменён.';
export const NETWORK_ERROR_MESSAGE = 'Нет соединения с интернетом. Проверьте сеть и попробуйте снова.';
export const SIGNUP_DISABLED_MESSAGE = 'Регистрация на сайте пока недоступна. Создайте аккаунт в приложении Écoute Moi.';
/**
 * Sign-in never creates accounts, so an unknown email is reported without
 * suggesting registration: a person who uses another sign-in method in the app
 * must not be pushed into creating a second account.
 */
export const ACCOUNT_NOT_FOUND_MESSAGE = 'Аккаунт с такой почтой не найден. Проверьте адрес или откройте приложение Écoute Moi.';

export function authErrorMessage(error: unknown): string {
  const message = rawMessage(error).toLowerCase();
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '').toLowerCase()
      : '';

  // Checked before "cancelled": OAuth providers report these with the
  // generic `access_denied` error code.
  if (includesAny(message, ['signups not allowed', 'signup is disabled'])) {
    return ACCOUNT_NOT_FOUND_MESSAGE;
  }
  if (includesAny(message, ['user is banned', 'banned'])) {
    return 'Доступ к аккаунту ограничен. Обратитесь в поддержку.';
  }
  if (
    includesAny(code, ['request_canceled', 'cancelled', 'canceled', 'access_denied']) ||
    includesAny(message, ['cancelled', 'canceled', 'access_denied', 'access denied'])
  ) {
    return AUTH_CANCELLED_MESSAGE;
  }
  if (includesAny(message, ['network request failed', 'failed to fetch', 'network error', 'offline', 'load failed'])) {
    return NETWORK_ERROR_MESSAGE;
  }
  // Web-only: PKCE links must be opened in the browser that requested them.
  if (
    includesAny(code, ['flow_state_not_found', 'flow_state_expired', 'bad_code_verifier']) ||
    includesAny(message, ['code verifier', 'invalid flow state', 'flow state'])
  ) {
    return 'Ссылка устарела или открыта в другом браузере. Откройте её в том же браузере, где начинали вход, или запросите новую.';
  }
  // Web-only: provider/email rate limits.
  if (
    includesAny(code, ['over_email_send_rate_limit', 'over_request_rate_limit']) ||
    includesAny(message, ['rate limit', 'for security purposes, you can only request'])
  ) {
    return 'Слишком много попыток. Подождите несколько минут и попробуйте снова.';
  }
  // Supabase Auth answers 500 unexpected_failure when its SMTP provider rejects the letter.
  if (includesAny(message, ['error sending', 'sending magic link', 'sending confirmation', 'could not send email'])
    || includesAny(code, ['unexpected_failure'])) {
    return 'Не удалось отправить письмо с кодом. Попробуйте позже или войдите в приложении Écoute Moi.';
  }
  if (includesAny(message, ['invalid login credentials', 'invalid credentials'])) {
    return 'Неверный email или пароль.';
  }
  if (includesAny(message, ['token has expired', 'otp_expired', 'invalid otp', 'token is invalid'])
    || includesAny(code, ['otp_expired'])) {
    return 'Код неверный или его срок действия истёк. Запросите новый код.';
  }
  if (includesAny(message, ['signups not allowed', 'user not found'])) {
    return ACCOUNT_NOT_FOUND_MESSAGE;
  }
  if (includesAny(message, ['email not confirmed', 'email_not_confirmed'])) {
    return 'Подтвердите email кодом из письма.';
  }
  if (includesAny(message, ['already registered', 'user already exists', 'identity already exists'])) {
    return 'Этот способ входа уже связан с другим аккаунтом.';
  }
  if (includesAny(message, ['weak password', 'password should be', 'password must'])) {
    return 'Пароль должен содержать не менее 8 символов, буквы и цифры.';
  }
  if (includesAny(message, ['same_password', 'should be different from the old password'])) {
    return 'Новый пароль должен отличаться от прежнего.';
  }
  if (includesAny(message, ['expired', 'authorization code'])) {
    return 'Срок действия авторизации истёк. Начните вход заново.';
  }
  if (includesAny(message, ['state', 'csrf'])) {
    return 'Не удалось безопасно подтвердить вход. Начните авторизацию заново.';
  }
  if (includesAny(message, ['timeout', 'timed out'])) {
    return 'Сервис входа не ответил вовремя. Попробуйте ещё раз.';
  }
  if (includesAny(message, ['banned', 'suspended', 'blocked'])) {
    return 'Доступ к аккаунту ограничен. Обратитесь в поддержку.';
  }
  if (includesAny(message, ['provider is not enabled', 'unsupported provider', 'provider not enabled'])) {
    return 'Этот способ входа пока недоступен на сайте. Используйте вход по почте или приложение.';
  }
  return 'Не удалось выполнить вход. Попробуйте ещё раз.';
}

export function validateEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Введите корректный email.');
  }
  return normalized;
}

export function validatePassword(password: string): void {
  if (password.length < 8 || !/[A-Za-zА-Яа-яЁё]/.test(password) || !/\d/.test(password)) {
    throw new Error('Пароль должен содержать не менее 8 символов, буквы и цифры.');
  }
}

/** Validation errors produced locally carry user-facing text already. */
export function isLocalValidationMessage(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  return (
    error.message.startsWith('Введите') ||
    error.message.startsWith('Парол') ||
    error.message.startsWith('Не удалось создать сессию') ||
    error.message === SIGNUP_DISABLED_MESSAGE
  );
}

export function userFacingAuthError(error: unknown): string {
  return isLocalValidationMessage(error) ? error.message : authErrorMessage(error);
}
