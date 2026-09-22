// Guards the web app against silently depending on backend objects that are
// not committed in ecoutemoi-mobile main. Every name allowed here must have a
// VERIFIED row with its source file in docs/WEB_BACKEND_MATRIX.md.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const VERIFIED_RPCS = [
  'cancel_my_web_subscription_v1',
  'get_my_account_restriction',
  'get_my_billing_status_v1',
  'get_my_blocked_users',
  'get_my_dating_profile_v5',
  'get_my_entitlement',
  'list_billing_offers_v1',
  'unblock_user',
];
// The only Edge Function the web invokes. It authenticates the caller from
// the access token and takes the price from the database, so the browser can
// neither choose an amount nor act for another account.
const VERIFIED_EDGE_FUNCTIONS = ['billing-create-checkout'];
const VERIFIED_TABLES = ['dating_profiles', 'privacy_settings', 'profiles'];
const VERIFIED_BUCKETS = ['dating-audio', 'dating-photos'];

const sources = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(name)) sources.push({ path, text: readFileSync(path, 'utf8') });
  }
};
walk('src');

/**
 * Comments legitimately name what must never appear in code (a service_role
 * key, a payment provider), so the code-level checks below read the sources
 * with comments removed.
 */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const code = sources.map(({ path, text }) => ({ path, text: stripComments(text) }));

const collect = (pattern) =>
  [...new Set(sources.flatMap(({ text }) => [...text.matchAll(pattern)].map((match) => match[1])))].sort();

test('only RPCs committed in mobile main are called', () => {
  assert.deepEqual(collect(/\.rpc\(\s*['"`]([A-Za-z0-9_]+)['"`]/g), VERIFIED_RPCS);
});

test('only verified tables are queried directly', () => {
  assert.deepEqual(collect(/\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/g), VERIFIED_TABLES);
});

test('only verified storage buckets are signed', () => {
  assert.deepEqual(collect(/signedUrl\(\s*['"`]([a-z0-9-]+)['"`]/g), VERIFIED_BUCKETS);
});

test('only verified Edge Functions are invoked', () => {
  assert.deepEqual(collect(/functions\s*\.\s*invoke\(\s*['"`]([A-Za-z0-9-]+)['"`]/g), VERIFIED_EDGE_FUNCTIONS);
  // A function must never be called by raw URL: that would bypass the
  // Authorization header supabase-js attaches.
  for (const { path, text } of sources) {
    assert.doesNotMatch(text, /\/functions\/v1\//, path);
  }
});

test('the browser never sends a price, a currency or a user id', () => {
  // Server-authoritative pricing: an offer id is the only product input.
  for (const { path, text } of code) {
    assert.doesNotMatch(text, /(amount|price|currency|duration_days)\s*:/, `${path} must not send pricing`);
    assert.doesNotMatch(text, /user_id\s*:/, `${path} must not send a user id`);
  }
});

test('no service_role key or payment provider secret can reach the bundle', () => {
  // Naming the provider that manages a subscription is fine (the backend
  // reports it); reaching its API, or carrying its credentials, is not.
  for (const { path, text } of code) {
    assert.doesNotMatch(text, /service_role|SUPABASE_SERVICE_ROLE/i, path);
    assert.doesNotMatch(text, /yookassa\.ru|api\.yookassa|shop_?id|secret_?key|Idempotence-Key/i, path);
  }
});
