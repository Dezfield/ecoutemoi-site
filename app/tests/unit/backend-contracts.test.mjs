// Guards the web app against silently depending on backend objects that are
// not committed in ecoutemoi-mobile main. Every name allowed here must have a
// VERIFIED row with its source file in docs/WEB_BACKEND_MATRIX.md
// (checked against ecoutemoi-mobile main 3098d8ca711180dffdf4e2da94b6ced98efbb8d1).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const VERIFIED_RPCS = Object.keys(JSON.parse(readFileSync('tests/backend-main-contracts.json','utf8')).rpcs).sort();
const VERIFIED_TABLES = ['dating_profiles', 'messages', 'privacy_settings', 'profiles'];
const VERIFIED_BUCKETS = ['chat-media', 'dating-audio', 'dating-photos'];
const VERIFIED_FUNCTIONS = ['delete-my-account-v2', 'oauth-broker', 'vk-id-auth', 'voice-media-link'];

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
  for (const bucket of collect(/(?:signedUrl|signedMedia)\(\s*['"`]([a-z0-9-]+)['"`]/g)) assert(VERIFIED_BUCKETS.includes(bucket));
  for (const bucket of collect(/storage\.from\(\s*['"`]([a-z0-9-]+)['"`]/g)) {
    assert(VERIFIED_BUCKETS.includes(bucket), `storage bucket ${bucket} must be verified`);
  }
  const productApi = sources.find(({ path }) => path.endsWith(join('product', 'api.ts')))?.text ?? '';
  assert.match(productApi, /bucket: 'dating-audio' \| 'dating-photos'/, 'dynamic bucket names remain a narrow type union');
});

test('only verified Edge Functions are invoked; delete-my-account with the confirmation phrase only', () => {
  assert.deepEqual(collect(/functions\s*\.\s*invoke\(\s*['"`]([a-z0-9-]+)['"`]/g), VERIFIED_FUNCTIONS);
  for (const { path, text } of sources) {
    assert.doesNotMatch(text, /\/functions\/v1\//, `${path}: no hand-built Edge Function URL`);
  }
  const api = sources.find(({ path }) => path.endsWith(join('account', 'api.ts'))).text;
  const call = api.slice(api.indexOf("invoke('delete-my-account-v2'"), api.indexOf("invoke('delete-my-account-v2'") + 200);
  assert.match(call, /body: \{ confirmation: 'delete-my-account', action: 'authorization' \}/);
  assert.doesNotMatch(call, /user_?id|userId/i, 'the target account is taken from the JWT, never sent');
});

test('own-account RPCs never receive a user id from the client', () => {
  for (const { path, text } of sources) {
    assert.doesNotMatch(text, /p_user_id|p_target_user_id/, path);
  }
});

test('no service-role key or provider secret is referenced in the web source', () => {
  for (const { path, text } of sources) {
    // Comments may mention the rule; code must not contain such a name.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /service_role|SERVICE_ROLE|sb_secret_/, path);
  }
});
