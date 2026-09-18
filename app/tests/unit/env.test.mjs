import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isValidSupabaseUrl, normalizeBaseUrl, parseOAuthProviders } from '../../src/lib/env.ts';

test('OAuth allowlist keeps only web-capable providers', () => {
  assert.deepEqual(parseOAuthProviders(undefined), []);
  assert.deepEqual(parseOAuthProviders(''), []);
  assert.deepEqual(parseOAuthProviders(' Google , apple ,vk,github'), ['apple', 'google']);
});

test('base URLs: https or loopback http only, no credentials/query', () => {
  assert.equal(normalizeBaseUrl('https://ecoutemoi.ru/', 'x'), 'https://ecoutemoi.ru');
  assert.equal(normalizeBaseUrl('http://127.0.0.1:4173', 'x'), 'http://127.0.0.1:4173');
  assert.equal(normalizeBaseUrl('http://ecoutemoi.ru', 'x'), 'x');
  assert.equal(normalizeBaseUrl('https://user:pass@ecoutemoi.ru', 'x'), 'x');
  assert.equal(normalizeBaseUrl('https://ecoutemoi.ru/?a=1', 'x'), 'x');
  assert.equal(normalizeBaseUrl('javascript:alert(1)', 'x'), 'x');
  assert.equal(normalizeBaseUrl(undefined, 'x'), 'x');
});

test('Supabase URL validation', () => {
  assert.equal(isValidSupabaseUrl('https://abc.supabase.co'), true);
  assert.equal(isValidSupabaseUrl('http://abc.supabase.co'), false);
  assert.equal(isValidSupabaseUrl(''), false);
  assert.equal(isValidSupabaseUrl(undefined), false);
});
