import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  enabledOAuthProviders,
  isValidSupabaseUrl,
  normalizeBaseUrl,
  parseEnabledFlag,
  parseOAuthProviders,
} from '../../src/lib/env.ts';

test('OAuth allowlist keeps only web-capable providers (never VK)', () => {
  assert.deepEqual(parseOAuthProviders(undefined), []);
  assert.deepEqual(parseOAuthProviders(''), []);
  assert.deepEqual(parseOAuthProviders(' Google , apple ,vk,github'), ['apple', 'google']);
});

test('signup flag is strict opt-in: only "true" enables it', () => {
  assert.equal(parseEnabledFlag(undefined), false);
  assert.equal(parseEnabledFlag(''), false);
  assert.equal(parseEnabledFlag('false'), false);
  assert.equal(parseEnabledFlag('1'), false);
  assert.equal(parseEnabledFlag('yes'), false);
  assert.equal(parseEnabledFlag('ture'), false);
  assert.equal(parseEnabledFlag(' TRUE '), true);
  assert.equal(parseEnabledFlag('true'), true);
});

test('OAuth providers are offered only while web signup is enabled', () => {
  assert.deepEqual(enabledOAuthProviders(['google'], false), []);
  assert.deepEqual(enabledOAuthProviders(['apple', 'google'], true), ['apple', 'google']);
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
