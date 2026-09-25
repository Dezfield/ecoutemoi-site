import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCallbackUrl } from '../../src/auth/callback.ts';

const base = 'https://app.ecoutemoi.ru/auth/callback';

test('PKCE code', () => {
  assert.deepEqual(parseCallbackUrl(`${base}?code=0f3c4b2a-9d8e-4f1a-b2c3-d4e5f6a7b8c9`), {
    kind: 'code', code: '0f3c4b2a-9d8e-4f1a-b2c3-d4e5f6a7b8c9', typeHint: null,
  });
});

test('token hash links with allowlisted types only', () => {
  assert.deepEqual(parseCallbackUrl(`${base}?token_hash=abcdef123456&type=recovery`), {
    kind: 'token_hash', tokenHash: 'abcdef123456', type: 'recovery',
  });
  assert.deepEqual(parseCallbackUrl(`${base}?token_hash=abcdef123456&type=phone_change`), { kind: 'empty' });
  assert.deepEqual(parseCallbackUrl(`${base}?token_hash=abc&type=email`), { kind: 'empty' });
});

test('errors in query or fragment win over codes', () => {
  assert.deepEqual(parseCallbackUrl(`${base}?error=access_denied&error_description=User+cancelled&code=abcdefgh`), {
    kind: 'error', code: 'access_denied', description: 'User cancelled',
  });
  assert.equal(parseCallbackUrl(`${base}#error=server_error`).kind, 'error');
});

test('implicit-flow tokens are rejected', () => {
  assert.deepEqual(parseCallbackUrl(`${base}#access_token=a&refresh_token=b`), { kind: 'implicit_tokens' });
});

test('malformed codes and empty callbacks', () => {
  assert.deepEqual(parseCallbackUrl(`${base}?code=<script>`), { kind: 'empty' });
  assert.deepEqual(parseCallbackUrl(base), { kind: 'empty' });
  assert.deepEqual(parseCallbackUrl('not a url'), { kind: 'empty' });
});

test('long error descriptions are truncated', () => {
  const result = parseCallbackUrl(`${base}?error=x&error_description=${'a'.repeat(1000)}`);
  assert.equal(result.kind, 'error');
  assert.equal(result.description.length, 300);
});
