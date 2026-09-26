// Guards the web app against silently depending on backend objects that are
// not committed in ecoutemoi-mobile main. Every name allowed here must have a
// VERIFIED row with its source file in docs/WEB_BACKEND_MATRIX.md
// (checked against ecoutemoi-mobile main fbe9058ec82ecf75b24878393efb29045f6753e0).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const VERIFIED_RPCS = [
  'block_user',
  'export_my_account_data',
  'get_my_active_sessions',
  'get_my_blocked_users',
  'get_my_dating_profile_v5',
  'get_my_entitlement',
  'get_my_inbox_v2',
  'get_my_login_methods',
  'get_my_notification_preferences_v1',
  'get_my_resonances_v6',
  'get_my_safety_center_v1',
  'get_voice_candidates_v4',
  'prepare_my_dating_media',
  'report_dating_candidate',
  'report_dating_resonance_content',
  'respond_to_photo_resonance',
  'respond_to_voice_candidate_v2',
  'save_my_dating_profile',
  'submit_moderation_appeal',
  'submit_user_report',
  'unblock_user',
  'update_my_notification_preferences_v1',
];
const VERIFIED_TABLES = ['dating_profiles', 'messages', 'privacy_settings', 'profiles'];
const VERIFIED_BUCKETS = ['dating-audio', 'dating-photos'];
const VERIFIED_FUNCTIONS = ['delete-my-account'];

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
  assert.deepEqual(collect(/(?:signedUrl|signedMedia)\(\s*['"`]([a-z0-9-]+)['"`]/g), VERIFIED_BUCKETS);
  for (const bucket of collect(/storage\.from\(\s*['"`]([a-z0-9-]+)['"`]/g)) {
    assert(VERIFIED_BUCKETS.includes(bucket), `storage bucket ${bucket} must be verified`);
  }
  const productApi = sources.find(({ path }) => path.endsWith(join('product', 'api.ts')))?.text ?? '';
  assert.match(productApi, /bucket: 'dating-audio' \| 'dating-photos'/, 'dynamic bucket names remain a narrow type union');
});

test('only the protected delete-my-account Edge Function is invoked, with the confirmation phrase only', () => {
  assert.deepEqual(collect(/functions\s*\.\s*invoke\(\s*['"`]([a-z0-9-]+)['"`]/g), VERIFIED_FUNCTIONS);
  for (const { path, text } of sources) {
    assert.doesNotMatch(text, /\/functions\/v1\//, `${path}: no hand-built Edge Function URL`);
  }
  const api = sources.find(({ path }) => path.endsWith(join('account', 'api.ts'))).text;
  const call = api.slice(api.indexOf("invoke('delete-my-account'"), api.indexOf("invoke('delete-my-account'") + 200);
  assert.match(call, /body: \{ confirmation: 'delete-my-account' \}/);
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
