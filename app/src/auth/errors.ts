/**
 * Auth error messages — ported from mobile/src/auth/errors.ts.
 * Business logic is identical to keep a unified user experience.
 */

const includesAny = (value: string, parts: string[]) =>
  parts.some((part) => value.includes(part));

export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const message = raw.toLowerCase();
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '').toLowerCase()
      : '';

  if (
    includesAny(code, ['request_canceled', 'cancelled', 'canceled']) ||
    includesAny(message, ['cancelled', 'canceled'])
  ) {
    return 'Вход отменён.';
  }
  if (
    includesAny(message, [
      'network request failed',
      'failed to fetch',
      'network error',
      'offline',
    ])
  ) {
    return 'Нет соединения с интернетом. Проверьте сеть и попробуйте снова.';
  }
  if (includesAny(message, ['invalid login credentials', 'invalid credentials'])) {
    return 'Неверный email или пароль.';
  }
  if (
    includesAny(message, [
      'token has expired',
      'otp_expired',
      'invalid otp',
      'token is invalid',
    ])
  ) {
    return 'Код неверный или его срок действия истёк. Запросите новый код.';
  }
  if (includesAny(message, ['signups not allowed', 'user not found'])) {
    return 'Аккаунт с таким email не найден.';
  }
  if (includesAny(message, ['email not confirmed', 'email_not_confirmed'])) {
    return 'Подтвердите email кодом из письма.';
  }
  if (
    includesAny(message, [
      'already registered',
      'user already exists',
      'identity already exists',
    ])
  ) {
    return 'Этот способ входа уже связан с другим аккаунтом. Автоматическое объединение отключено для вашей безопасности.';
  }
  if (
    includesAny(message, ['weak password', 'password should be', 'password must'])
  ) {
    return 'Пароль должен содержать не менее 8 символов, буквы и цифры.';
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
  return 'Не удалось выполнить вход. Попробуйте ещё раз.';
}

export function validateEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error('Введите корректный email.');
  }
  return normalized;
}
