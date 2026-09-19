// Guards the web app against silently depending on backend objects that are
// not committed in ecoutemoi-mobile main. Every name allowed here must have a
// VERIFIED row with its source file in docs/WEB_BACKEND_MATRIX.md.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const VERIFIED_RPCS = [
  'get_my_account_restriction',
  'get_my_blocked_users',
  'get_my_dating_profile_v5',
  'get_my_entitlement',
  'unblock_user',
];
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

test('no Edge Function is invoked (none is verified for the web)', () => {
  for (const { path, text } of sources) {
    assert.doesNotMatch(text, /functions\s*\.\s*invoke|\/functions\/v1\//, path);
  }
});
