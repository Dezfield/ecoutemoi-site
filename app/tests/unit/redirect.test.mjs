import assert from 'node:assert/strict';
import { test } from 'node:test';

import { consumeNextPath, rememberNextPath, safeInternalPath } from '../../src/lib/redirect.ts';

test('accepts internal product and account paths', () => {
  assert.equal(safeInternalPath('/account'), '/account');
  assert.equal(safeInternalPath('/account/security?tab=1#x'), '/account/security?tab=1#x');
  assert.equal(safeInternalPath('/voices'), '/voices');
  assert.equal(safeInternalPath('/chats/00000000-0000-0000-0000-000000000001'), '/chats/00000000-0000-0000-0000-000000000001');
});

test('rejects open-redirect and non-private targets', () => {
  for (const value of [
    'https://evil.example/account',
    '//evil.example/account',
    '/\\evil.example',
    'javascript:alert(1)',
    '/account\u0000',
    '/accounts',
    '/login',
    '/auth/callback',
    '',
    null,
    42,
    '  //evil.example',
    '/account/../login',
  ]) {
    assert.equal(safeInternalPath(value), '/voices', String(value));
  }
});

test('remember/consume next path uses storage once and validates it', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  rememberNextPath('/account/blocked', storage);
  assert.equal(consumeNextPath(storage), '/account/blocked');
  assert.equal(consumeNextPath(storage), '/voices');
  store.set('ecoutemoi.auth.next', 'https://evil.example');
  assert.equal(consumeNextPath(storage), '/voices');
});

test('storage failures fall back to the default destination', () => {
  const broken = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => rememberNextPath('/account/profile', broken));
  assert.equal(consumeNextPath(broken), '/voices');
});
