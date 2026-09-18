import assert from 'node:assert/strict';
import { test } from 'node:test';

import { authErrorMessage, userFacingAuthError, validateEmail, validatePassword } from '../../src/auth/errors.ts';

test('maps known auth failures to the mobile wording', () => {
  assert.equal(authErrorMessage(new Error('Failed to fetch')), 'Нет соединения с интернетом. Проверьте сеть и попробуйте снова.');
  assert.equal(authErrorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' }), 'Код неверный или его срок действия истёк. Запросите новый код.');
  assert.equal(authErrorMessage(Object.assign(new Error('User cancelled'), { code: 'access_denied' })), 'Вход отменён.');
  assert.equal(authErrorMessage(Object.assign(new Error('Signups not allowed for otp'), { code: 'access_denied' })), 'Аккаунт с таким email не найден. Выберите регистрацию.');
  assert.equal(authErrorMessage(new Error('PKCE code verifier not found in storage')), 'Ссылка устарела или открыта в другом браузере. Откройте её в том же браузере, где начинали вход, или запросите новую.');
  assert.equal(authErrorMessage({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }), 'Слишком много попыток. Подождите несколько минут и попробуйте снова.');
});

test('never echoes raw server text', () => {
  const message = authErrorMessage(new Error('<img src=x onerror=alert(1)> internal stack at db.go:42'));
  assert.equal(message, 'Не удалось выполнить вход. Попробуйте ещё раз.');
  assert.equal(userFacingAuthError(new Error('raw internal detail')), 'Не удалось выполнить вход. Попробуйте ещё раз.');
});

test('local validation messages are shown as-is', () => {
  assert.throws(() => validateEmail('nope'), /Введите корректный email/);
  assert.equal(validateEmail('  Tester@Example.COM '), 'tester@example.com');
  assert.throws(() => validatePassword('short1'), /Пароль должен содержать/);
  assert.throws(() => validatePassword('longpassword'), /Пароль должен содержать/);
  assert.doesNotThrow(() => validatePassword('пароль2026'));
  try {
    validateEmail('');
  } catch (error) {
    assert.equal(userFacingAuthError(error), 'Введите корректный email.');
  }
});
