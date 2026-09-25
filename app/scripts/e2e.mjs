// End-to-end browser checks of the built web app against a MOCKED Supabase
// backend (Playwright request interception). No real project, account,
// email or credential is used: the fake project URL is never reachable.
//
//   npm run test:e2e
//
// The mock implements ONLY backend contracts committed in ecoutemoi-mobile
// main (see docs/WEB_BACKEND_MATRIX.md) with the shapes defined there. Any
// other RPC, table, storage bucket or Edge Function request is recorded and
// fails the check, so these tests cannot pass by agreeing with an invented
// backend.
//
// Two builds are tested: the production-default build (web signup disabled)
// and a build with VITE_AUTH_SIGNUP_ENABLED=true.
//
// Browser selection: E2E_CHROMIUM_PATH=<chrome binary> or
// E2E_BROWSER_CHANNEL=msedge|chrome; otherwise Playwright's bundled Chromium.
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

import { startServer } from './serve.mjs';

const SUPABASE_URL = 'https://e2e.supabase.test';
const STORAGE_KEY = 'sb-e2e-auth-token';
const PORT = Number(process.env.E2E_PORT || 4175);
const APP = `http://127.0.0.1:${PORT}`;
const SIGNUP_APP = `http://127.0.0.1:${PORT + 1}`;
const DIST = resolve('dist-e2e');
const SIGNUP_DIST = resolve('dist-e2e-signup');

// ---------------------------------------------------------------- build
function build(outDir, extraEnv) {
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: 'e2e-publishable-key',
      VITE_PUBLIC_SITE_URL: 'https://ecoutemoi.ru',
      // Google is requested in both builds: it must stay hidden while signup is disabled.
      VITE_AUTH_OAUTH_PROVIDERS: 'google',
      VITE_AUTH_SIGNUP_ENABLED: '',
      ...extraEnv,
    },
  });
}

if (!process.env.E2E_SKIP_BUILD) {
  build(DIST, {});
  build(SIGNUP_DIST, { VITE_AUTH_SIGNUP_ENABLED: 'true' });
}

// ---------------------------------------------------------------- mock backend
const USER_ID = '5f1c7a3e-2b4d-4c6e-8a9b-0c1d2e3f4a5b';
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const nowSeconds = () => Math.floor(Date.now() / 1000);

// Verified contracts (ecoutemoi-mobile main). Keep in sync with docs/WEB_BACKEND_MATRIX.md.
const VERIFIED_RPCS = new Set([
  'block_user',
  'get_my_inbox_v2',
  'get_my_resonances_v6',
  'get_voice_candidates_v4',
  'prepare_my_dating_media',
  'respond_to_photo_resonance',
  'respond_to_voice_candidate_v2',
  'save_my_dating_profile',
  'report_dating_candidate',
  'report_dating_resonance_content',
  'submit_user_report',
  'get_my_dating_profile_v5',
  'get_my_entitlement',
  'get_my_blocked_users',
  'unblock_user',
  'get_my_login_methods',
  'get_my_active_sessions',
  'export_my_account_data',
  'get_my_notification_preferences_v1',
  'update_my_notification_preferences_v1',
  'get_my_safety_center_v1',
  'submit_moderation_appeal',
]);
// The ten account RPCs guarded by private.require_existing_account() in mobile main
// (20260921120100_account_rpc_deletion_guards.sql) that the web calls.
const GUARDED_RPCS = new Set([
  'get_my_login_methods',
  'get_my_active_sessions',
  'export_my_account_data',
  'get_my_notification_preferences_v1',
  'update_my_notification_preferences_v1',
  'get_my_safety_center_v1',
  'submit_moderation_appeal',
]);
const VERIFIED_TABLES = new Set(['profiles', 'dating_profiles', 'messages', 'privacy_settings']);
const VERIFIED_BUCKETS = new Set(['dating-photos', 'dating-audio']);
const VERIFIED_FUNCTIONS = new Set(['delete-my-account']);
const SANCTION_ID = '33333333-3333-4333-8333-333333333333';
const CONTACT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FOREIGN_CONVERSATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const IMPRESSION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const RESONANCE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const identity = (provider) => ({
  id: `${provider}-identity`,
  identity_id: `${provider}-identity-id`,
  user_id: USER_ID,
  provider,
  identity_data: {},
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
});

function makeUser(email, identities = [identity('email')]) {
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    app_metadata: { provider: 'email', providers: identities.map((item) => item.provider) },
    user_metadata: {},
    identities,
  };
}

function makeSession(email = 'tester@example.com') {
  const exp = nowSeconds() + 3600;
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: USER_ID, aud: 'authenticated', role: 'authenticated', email, exp, iat: nowSeconds(), session_id: 'sess-current',
  })}.e2e-signature`;
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'e2e-refresh-token',
    user: makeUser(email),
  };
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function createMock() {
  const state = {
    onboardingComplete: true,
    datingProfileFails: false,
    identities: [identity('email')],
    // get_my_entitlement() always returns exactly one row: (tier, is_premium, premium_until).
    entitlement: { tier: 'premium', is_premium: true, premium_until: '2026-12-31T00:00:00Z' },
    // get_my_login_methods(): jsonb array, one entry per apple/google/vk/email.
    loginMethods: [
      { provider: 'apple', connected: false, identityId: null, label: null },
      { provider: 'google', connected: false, identityId: null, label: null },
      { provider: 'vk', connected: false, identityId: null, label: null },
      { provider: 'email', connected: true, identityId: 'email-identity', label: 'tester@example.com' },
    ],
    // get_my_active_sessions(): table rows; current_session is derived from the JWT session id.
    sessions: [
      { session_id: 'sess-current', created_at: '2026-09-20T10:00:00Z', updated_at: '2026-09-24T09:00:00Z', user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140', ip_address: '192.0.2.10', current_session: true },
      { session_id: 'sess-phone', created_at: '2026-09-18T10:00:00Z', updated_at: '2026-09-23T20:00:00Z', user_agent: 'Ecoute Moi/1.0 (iPhone; iOS 18)', ip_address: '198.51.100.7', current_session: false },
    ],
    // jsonb of get_/update_my_notification_preferences_v1.
    notificationPreferences: {
      messagesEnabled: true, datingEnabled: true, productEnabled: false, quietHoursEnabled: false,
      quietStart: '22:00', quietEnd: '08:00', timezone: 'Europe/Moscow', deliveryMode: 'instant',
      safetyAlwaysOn: true, updatedAt: '2026-09-20T10:00:00Z',
    },
    // jsonb of get_my_safety_center_v1().
    safety: { accountStatus: 'clear', activeSanction: null, recentReports: [], recentAppeals: [], hasMoreReports: false },
    // delete-my-account behaviour: 'ok' → 200 { deleted: true }; 'fail' → 400 account_deletion_failed.
    deleteMode: 'ok',
    deleteDelayMs: 0,
    deleteRequests: 0,
    deleted: false,
    blocked: [
      { user_id: '11111111-1111-4111-8111-111111111111', display_name: 'Анна', blocked_at: '2026-09-10T12:00:00Z' },
      { user_id: '22222222-2222-4222-8222-222222222222', display_name: 'Мария', blocked_at: '2026-09-11T12:00:00Z' },
    ],
    voices: [],
    resonances: [],
    conversations: [],
    messages: [],
    failNextSend: false,
    calls: [],
    callsAfterDeletion: [],
    unverified: [],
  };

  const json = (route, status, body, cors) =>
    route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: body === undefined ? '' : JSON.stringify(body) });

  async function handle(route) {
    const request = route.request();
    const origin = request.headers().origin;
    const cors = {
      'access-control-allow-origin': origin === APP || origin === SIGNUP_APP ? origin : APP,
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-expose-headers': '*',
    };
    const url = new URL(request.url());
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname;
    let body = {};
    try { body = request.postDataJSON() ?? {}; } catch { body = {}; }
    state.calls.push({ method, path, search: url.search, body });
    const unverified = () => {
      state.unverified.push(`${method} ${path}`);
      return json(route, 404, { code: 'PGRST202', message: `not a verified backend contract: ${path}` }, cors);
    };

    // ---- Supabase Auth (GoTrue) endpoints used by supabase-js
    if (path === '/auth/v1/otp') return json(route, 200, {}, cors);
    if (path === '/auth/v1/verify') {
      if (body.token_hash) {
        if (body.token_hash === 'valid-token-hash-1234') return json(route, 200, makeSession(), cors);
        return json(route, 403, { code: 'otp_expired', msg: 'Email link is invalid or has expired' }, cors);
      }
      if (body.token === '123456') return json(route, 200, makeSession(body.email), cors);
      return json(route, 403, { code: 'otp_expired', error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, cors);
    }
    if (path === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') return json(route, 200, makeSession(), cors);
      return json(route, 400, { code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' }, cors);
    }
    if (state.deleted && (path === '/auth/v1/user' || path === '/auth/v1/logout')) {
      // GoTrue after soft deletion: the session no longer exists.
      return json(route, 403, { code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' }, cors);
    }
    if (path === '/auth/v1/user') return json(route, 200, makeUser('tester@example.com', state.identities), cors);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });

    // ---- PostgREST RPC: verified functions only
    if (path.startsWith('/rest/v1/rpc/')) {
      const rpc = path.slice('/rest/v1/rpc/'.length);
      if (!VERIFIED_RPCS.has(rpc)) return unverified();
      if (state.deleted) {
        state.callsAfterDeletion.push(rpc);
        if (GUARDED_RPCS.has(rpc)) return json(route, 403, { code: '42501', message: 'Account is unavailable' }, cors);
      }
      switch (rpc) {
        case 'get_my_login_methods':
          return json(route, 200, state.loginMethods, cors);
        case 'get_my_active_sessions':
          return json(route, 200, state.sessions, cors);
        case 'export_my_account_data':
          return json(route, 200, {
            formatVersion: 1, generatedAt: '2026-09-24T10:00:00Z', scopeNote: 'The export contains account data and content created by the requesting user.',
            account: { id: USER_ID, email: 'tester@example.com' }, profile: { id: USER_ID, display_name: 'Алиса' },
            datingProfile: {}, datingPhotos: [], privacySettings: {}, sentMessages: [], blocksCreated: [],
            reportsSubmitted: [], sanctionsReceived: [], appealsSubmitted: [], feedbackSubmitted: [], premiumPreferences: {},
          }, cors);
        case 'get_my_notification_preferences_v1':
          return json(route, 200, state.notificationPreferences, cors);
        case 'update_my_notification_preferences_v1': {
          const expected = ['p_dating_enabled', 'p_delivery_mode', 'p_messages_enabled', 'p_product_enabled', 'p_quiet_end', 'p_quiet_hours_enabled', 'p_quiet_start', 'p_timezone'];
          if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(expected)
            || !['instant', 'hourly', 'daily'].includes(body.p_delivery_mode)
            || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.p_quiet_start) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.p_quiet_end)) {
            state.unverified.push(`update_my_notification_preferences_v1 with unexpected arguments ${JSON.stringify(body)}`);
            return json(route, 400, { code: '22023', message: 'invalid arguments' }, cors);
          }
          state.notificationPreferences = {
            ...state.notificationPreferences,
            messagesEnabled: body.p_messages_enabled, datingEnabled: body.p_dating_enabled, productEnabled: body.p_product_enabled,
            quietHoursEnabled: body.p_quiet_hours_enabled, quietStart: body.p_quiet_start, quietEnd: body.p_quiet_end,
            timezone: body.p_timezone, deliveryMode: body.p_delivery_mode, updatedAt: '2026-09-24T10:00:00Z',
          };
          return json(route, 200, state.notificationPreferences, cors);
        }
        case 'get_my_safety_center_v1':
          return json(route, 200, state.safety, cors);
        case 'submit_moderation_appeal': {
          const sanction = state.safety.activeSanction;
          if (!sanction || body.p_sanction_id !== sanction.id || Object.keys(body).sort().join() !== 'p_reason,p_sanction_id') {
            return json(route, 400, { code: '22023', message: 'Sanction is not active' }, cors);
          }
          sanction.appeal = { id: '44444444-4444-4444-8444-444444444444', reason: body.p_reason, status: 'pending', createdAt: '2026-09-24T10:00:00Z', updatedAt: '2026-09-24T10:00:00Z' };
          return json(route, 200, sanction.appeal.id, cors);
        }
        case 'get_my_dating_profile_v5':
          return json(route, 200, state.onboardingComplete ? [{
            display_name: 'Алиса', about: 'Люблю долгие прогулки и джаз.', birth_date: '1996-03-14', city: 'Москва',
            gender_code: 'woman', looking_for: ['man'], relationship_goal: 'serious',
            interests: ['музыка', 'книги'], languages: ['ru', 'en'], preferred_min_age: 27, preferred_max_age: 40,
            audio_prompt_key: 'good_day', audio_path: null, audio_duration_seconds: 32,
            photo_paths: [`${USER_ID}/photos/1`], onboarding_complete: true, discovery_enabled: true,
            profile_values: ['честность'], children_preference: 'open', smoking_code: 'never', alcohol_code: 'occasionally',
            communication_pace: 'balanced', what_matters: '', zodiac_sign: 'pisces', country_code: 'RU',
          }] : [], cors);
        case 'get_my_entitlement':
          return json(route, 200, [state.entitlement], cors);
        case 'get_voice_candidates_v4':
          return json(route, 200, state.voices, cors);
        case 'prepare_my_dating_media':
          return json(route, 200, [{ audio_path: `letters/${USER_ID}` }], cors);
        case 'save_my_dating_profile':
          if (body.p_audio_path !== `letters/${USER_ID}` || body.p_audio_duration_seconds < 20 || body.p_audio_duration_seconds > 45 || !state.audioUploaded) return json(route, 400, { code: '22023' }, cors);
          return route.fulfill({ status: 204, headers: cors });
        case 'respond_to_voice_candidate_v2': {
          if (body.p_impression_id !== IMPRESSION_ID || typeof body.p_interested !== 'boolean') return json(route, 403, { code: '42501' }, cors);
          state.voices = state.voices.filter((item) => item.impression_id !== IMPRESSION_ID);
          if (body.p_interested && state.reciprocalInterest) {
            state.resonances = [{ resonance_id: RESONANCE_ID, contact_id: CONTACT_ID, display_name: 'Мария', about: 'Люблю книги', age: 31, city: 'Москва', relationship_goal: 'serious', interests: ['книги'], photo_paths: [`${CONTACT_ID}/photos/1`], my_photo_decision: null, stage: 'resonance', conversation_id: null, resonated_at: '2026-09-24T11:00:00Z' }];
          }
          return json(route, 200, [{ result_status: state.resonances.length ? 'resonance' : 'saved', resonance_id: state.resonances.length ? RESONANCE_ID : null }], cors);
        }
        case 'get_my_resonances_v6':
          return json(route, 200, state.resonances, cors);
        case 'report_dating_candidate':
          if (!state.voices.some((item) => item.impression_id === body.p_impression_id)) return json(route, 403, { code: '42501' }, cors);
          state.voices = state.voices.filter((item) => item.impression_id !== body.p_impression_id);
          return json(route, 200, 'ffffffff-ffff-4fff-8fff-ffffffffffff', cors);
        case 'report_dating_resonance_content':
          if (!state.resonances.some((item) => item.resonance_id === body.p_resonance_id)) return json(route, 403, { code: '42501' }, cors);
          state.resonances = state.resonances.filter((item) => item.resonance_id !== body.p_resonance_id);
          return json(route, 200, 'ffffffff-ffff-4fff-8fff-ffffffffffff', cors);
        case 'respond_to_photo_resonance': {
          if (!state.resonances.some((item) => item.resonance_id === body.p_resonance_id)) return json(route, 403, { code: '42501' }, cors);
          state.resonances = state.resonances.map((item) => ({ ...item, my_photo_decision: body.p_interested ? 'interest' : 'pass', stage: body.p_interested && state.reciprocalPhotoInterest ? 'mutuality' : 'resonance', conversation_id: body.p_interested && state.reciprocalPhotoInterest ? CONVERSATION_ID : null }));
          if (body.p_interested && state.reciprocalPhotoInterest && !state.conversations.length) {
            state.conversations = [{ conversation_id: CONVERSATION_ID, contact_id: CONTACT_ID, contact_name: 'Мария', contact_avatar_path: null, last_message_text: null, last_message_at: '2026-09-24T11:00:00Z', unread_count: 0, blocked_by_me: false, blocked_by_contact: false, lifecycle_status: 'active', comfort_state: 'normal', contact_restricted: false }];
          }
          return json(route, 200, [{ result_status: state.conversations.length ? 'mutuality' : 'waiting', opened_conversation_id: state.conversations.length ? CONVERSATION_ID : null }], cors);
        }
        case 'get_my_inbox_v2':
          return json(route, 200, state.conversations, cors);
        case 'block_user':
          state.conversations = state.conversations.map((item) => item.contact_id === body.p_blocked_user_id ? { ...item, blocked_by_me: true } : item);
          return route.fulfill({ status: 204, headers: cors });
        case 'submit_user_report':
          if (!state.conversations.some((item) => item.conversation_id === body.p_conversation_id && item.contact_id === body.p_reported_user_id)) return json(route, 403, { code: '42501' }, cors);
          return json(route, 200, 'ffffffff-ffff-4fff-8fff-ffffffffffff', cors);
        case 'get_my_blocked_users':
          return json(route, 200, state.blocked, cors);
        case 'unblock_user':
          state.blocked = state.blocked.filter((item) => item.user_id !== body.p_blocked_user_id);
          return route.fulfill({ status: 204, headers: cors });
      }
    }

    // ---- PostgREST tables: own rows only (RLS), verified tables only
    if (path.startsWith('/rest/v1/')) {
      const table = path.slice('/rest/v1/'.length);
      if (!VERIFIED_TABLES.has(table)) return unverified();
      if (table === 'messages') {
        const id = method === 'POST' ? body.conversation_id : url.searchParams.get('conversation_id')?.replace(/^eq\./, '');
        if (!state.conversations.some((item) => item.conversation_id === id)) return method === 'GET' ? json(route, 200, [], cors) : json(route, 403, { code: '42501' }, cors);
        if (method === 'POST') {
          if (state.failNextSend) { state.failNextSend = false; return json(route, 503, { code: 'XX000' }, cors); }
          if (state.conversations.find((item) => item.conversation_id === id)?.blocked_by_me) return json(route, 403, { code: '42501' }, cors);
          if (!state.messages.some((item) => item.client_message_id === body.client_message_id)) state.messages.push({ ...body, id: crypto.randomUUID(), media_path: null, deleted_for_everyone_at: null, created_at: new Date().toISOString() });
          return route.fulfill({ status: 201, headers: { ...cors, 'content-type': 'application/json' }, body: '' });
        }
        const before = url.searchParams.get('created_at')?.replace(/^lt\./, '');
        const rows = state.messages.filter((item) => item.conversation_id === id && (!before || item.created_at < before)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 31);
        return json(route, 200, rows, cors);
      }
      if (url.searchParams.get(table === 'profiles' ? 'id' : 'user_id') !== `eq.${USER_ID}`) {
        state.unverified.push(`${method} ${path}: not filtered by the own user id`);
        return json(route, 400, { code: 'PGRST100', message: 'unexpected filter' }, cors);
      }
      if (table === 'profiles') return json(route, 200, [{ id: USER_ID, display_name: 'Алиса', created_at: '2026-09-01T10:00:00Z' }], cors);
      if (table === 'dating_profiles') {
        if (state.datingProfileFails) return json(route, 500, { code: 'XX000', message: 'internal error' }, cors);
        return json(route, 200, state.onboardingComplete ? [{ onboarding_complete: true }] : [], cors);
      }
      return json(route, 200, [{ nearby_opt_in: false }], cors);
    }

    // ---- Storage: signed URLs for own private media in verified buckets
    if (path.startsWith('/storage/v1/object/sign/')) {
      const bucket = path.slice('/storage/v1/object/sign/'.length).split('/')[0];
      if (!VERIFIED_BUCKETS.has(bucket)) return unverified();
      if (method === 'POST') return json(route, 200, { signedURL: `${path.replace('/storage/v1', '')}?token=e2e` }, cors);
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: PNG_1PX });
    }
    if (path === `/storage/v1/object/dating-audio/letters/${USER_ID}` && method === 'POST') {
      state.audioUploaded = true;
      return json(route, 200, { Key: `dating-audio/letters/${USER_ID}` }, cors);
    }

    // ---- Edge Function delete-my-account (mobile main supabase/functions/delete-my-account/index.ts)
    if (path.startsWith('/functions/v1/')) {
      const name = path.slice('/functions/v1/'.length);
      if (!VERIFIED_FUNCTIONS.has(name) || method !== 'POST') return unverified();
      const bearer = request.headers().authorization ?? '';
      if (!bearer.startsWith('Bearer ') || bearer.includes('e2e-publishable-key')) {
        return json(route, 401, { error: 'authentication_required' }, cors);
      }
      if (JSON.stringify(body) !== JSON.stringify({ confirmation: 'delete-my-account' })) {
        state.unverified.push(`delete-my-account with unexpected body ${JSON.stringify(body)}`);
        return json(route, 400, { error: 'confirmation_required' }, cors);
      }
      state.deleteRequests += 1;
      if (state.deleteDelayMs) await new Promise((done) => setTimeout(done, state.deleteDelayMs));
      if (state.deleteMode === 'fail') return json(route, 400, { error: 'account_deletion_failed' }, cors);
      state.deleted = true;
      return json(route, 200, { deleted: true }, cors);
    }

    // Anything else: no verified contract exists.
    return unverified();
  }

  return { state, handle };
}

// ---------------------------------------------------------------- runner
const servers = [await startServer(PORT, DIST), await startServer(PORT + 1, SIGNUP_DIST)];
const executablePath = process.env.E2E_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ headless: true, executablePath, channel: executablePath ? undefined : process.env.E2E_BROWSER_CHANNEL });

const results = [];
let failures = 0;

async function newContext({ viewport = { width: 1280, height: 900 }, signedIn = false, mockSetup, app = APP } = {}) {
  const mock = createMock();
  mockSetup?.(mock.state);
  const context = await browser.newContext({ viewport, locale: 'ru-RU', timezoneId: 'Europe/Moscow' });
  await context.route(`${SUPABASE_URL}/**`, (route) => mock.handle(route));
  // Any other external request must not happen.
  await context.route((url) => !url.href.startsWith(app) && !url.href.startsWith(SUPABASE_URL), (route) => {
    mock.state.calls.push({ external: route.request().url() });
    return route.abort();
  });
  if (signedIn) {
    const session = makeSession();
    await context.addInitScript(([key, value]) => {
      if (!window.localStorage.getItem(`${key}-e2e-seeded`)) {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem(`${key}-e2e-seeded`, '1');
      }
    }, [STORAGE_KEY, JSON.stringify(session)]);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(`console: ${message.text()}`);
  });
  // Every context ends with the backend-contract check.
  const close = async () => {
    await context.close();
    assert.deepEqual(mock.state.unverified, [], 'requests to backend objects that are not verified in ecoutemoi-mobile main');
    assert.deepEqual(mock.state.calls.filter((call) => call.external), [], 'no third-party requests');
  };
  return { context, page, mock, errors, close };
}

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    results.push({ name, ok: false, error: String(error?.message ?? error) });
    console.log(`  ✗ ${name}\n    ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n    ')}`);
  }
}

async function noOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `Horizontal overflow ${overflow}px on ${label}`);
}

async function axe(page, label) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const violations = report.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  assert.equal(violations.length, 0, `axe violations on ${label}:\n${violations.join('\n')}`);
}

async function loginWithCode(page) {
  await page.getByLabel('Email').fill('Tester@Example.com ');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Подтвердить код' }).click();
}

const bodyText = (page) => page.locator('body').innerText();

console.log('Web app E2E (mocked Supabase, verified contracts only)');

// ------------------------------------------------------------ auth & routing
await step('login page: renders, no private data, noindex, no overflow, axe clean (390 & 1440)', async () => {
  for (const width of [390, 1440]) {
    const { page, errors, close } = await newContext({ viewport: { width, height: 900 } });
    await page.goto(`${APP}/login`);
    await page.getByRole('heading', { name: 'Добро пожаловать' }).waitFor();
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow');
    await noOverflow(page, `/login @${width}`);
    await axe(page, `/login @${width}`);
    assert.deepEqual(errors, []);
    await close();
  }
  const { page, close } = await newContext();
  const robots = await page.request.get(`${APP}/robots.txt`);
  assert.equal((await robots.text()).replace(/\r\n/g, '\n').trim(), 'User-agent: *\nDisallow: /');
  await close();
});

await step('protected route: /account without session redirects to /login', async () => {
  const { page, close } = await newContext();
  await page.goto(`${APP}/account/security`);
  await page.waitForURL(`${APP}/login`);
  assert.equal(await page.getByText('Статус аккаунта').count(), 0, 'no private content');
  await close();
});

await step('email OTP: sign-in never creates users; wrong code error; correct code returns to the requested page', async () => {
  const { page, mock, errors, close } = await newContext();
  await page.goto(`${APP}/account/blocked`);
  await page.waitForURL(`${APP}/login`);
  await page.getByLabel('Email').fill('tester@example.com');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('000000');
  await page.getByRole('button', { name: 'Подтвердить код' }).click();
  await page.getByText('Код неверный или его срок действия истёк').waitFor();
  const otp = mock.state.calls.find((call) => call.path === '/auth/v1/otp');
  assert.equal(otp.body.email, 'tester@example.com');
  assert.equal(otp.body.create_user, false, 'sign-in must not create users');
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Подтвердить код' }).click();
  await page.waitForURL(`${APP}/account/blocked`);
  await page.getByRole('heading', { name: 'Заблокированные пользователи', level: 1 }).waitFor();
  assert.deepEqual(errors, []);
  await close();
});

await step('login copy: unavailable methods are named and email login is not promised to open the same account', async () => {
  const { page, close } = await newContext();
  await page.goto(`${APP}/login`);
  await page.getByRole('heading', { name: 'Добро пожаловать' }).waitFor();
  const text = await bodyText(page);
  assert.match(text, /Вход по номеру телефона, через Apple, через Google и через VK на сайте пока недоступен/);
  assert.match(text, /вход по коду на почту не обязательно откроет тот же аккаунт/);
  assert.doesNotMatch(text, /войдите по почте, привязанной к аккаунту/);
  assert.doesNotMatch(text, /вы принимаете/i, 'no acceptance of unapproved legal documents');
  assert.equal(await page.getByRole('link', { name: /Восстановить пароль/ }).count(), 0, 'no password entry point without password sign-in');
  await close();
});

await step('signup flag OFF (production default): no registration form, no create_user request, no OAuth buttons', async () => {
  const { page, mock, close } = await newContext();
  await page.goto(`${APP}/login`);
  await page.getByText('Нет аккаунта? Создайте его в приложении Écoute Moi.').waitFor();
  assert.equal(await page.getByRole('link', { name: 'Создать аккаунт' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /Продолжить с (Google|Apple)/ }).count(), 0, 'OAuth creates users, so it stays hidden');
  await page.goto(`${APP}/signup`);
  await page.getByText('Регистрация на сайте пока недоступна. Создайте аккаунт в приложении Écoute Moi.').waitFor();
  assert.equal(await page.getByLabel('Email').count(), 0, 'no registration form');
  assert.equal(mock.state.calls.filter((call) => call.path === '/auth/v1/otp').length, 0);
  await axe(page, '/signup (disabled)');
  await close();
});

await step('signup flag ON: registration form requests create_user=true and OAuth is offered', async () => {
  const { page, mock, close } = await newContext({ app: SIGNUP_APP });
  await page.goto(`${SIGNUP_APP}/login`);
  await page.getByRole('link', { name: 'Создать аккаунт' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Продолжить с Google' }).count(), 1);
  await page.goto(`${SIGNUP_APP}/signup`);
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').waitFor();
  const otp = mock.state.calls.find((call) => call.path === '/auth/v1/otp');
  assert.equal(otp.body.create_user, true);
  assert.doesNotMatch(await bodyText(page), /вы принимаете/i);
  await close();
});

await step('session restore after reload + overview with dating profile data', async () => {
  const { page, errors, close } = await newContext();
  await page.goto(`${APP}/login`);
  await loginWithCode(page);
  await page.waitForURL(`${APP}/voices`);
  await page.goto(`${APP}/account`);
  await page.getByText('Алиса').first().waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Обзор', level: 1 }).waitFor();
  await page.locator('.profile-hero-age', { hasText: '30 лет' }).waitFor(); // age computed from birth date
  await page.getByText('Москва, Россия').waitFor(); // city + country_code label
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  assert(stored && JSON.parse(stored).access_token, 'session persisted by supabase-js');
  assert.deepEqual(errors, []);
  await close();
});

await step('safe redirect: a crafted post-login destination is ignored after the callback', async () => {
  const { page, close } = await newContext();
  await page.goto(`${APP}/login`);
  await page.evaluate(() => window.sessionStorage.setItem('ecoutemoi.auth.next', 'https://evil.example/steal'));
  await page.goto(`${APP}/auth/callback?token_hash=valid-token-hash-1234&type=email`);
  await page.waitForURL(`${APP}/voices`);
  await close();
});

// ------------------------------------------------------------ account sections
await step('account sections render and are responsive (390–1440) and axe clean', async () => {
  const pages = [
    ['/account', 'Обзор'],
    ['/account/profile', 'Профиль'],
    ['/account/settings', 'Аккаунт и вход'],
    ['/account/privacy', 'Конфиденциальность'],
    ['/account/notifications', 'Уведомления'],
    ['/account/subscription', 'Premium'],
    ['/account/security', 'Безопасность'],
    ['/account/blocked', 'Заблокированные пользователи'],
    ['/account/support', 'Поддержка'],
    ['/account/legal', 'Документы'],
    ['/account/delete', 'Удаление аккаунта'],
  ];
  for (const width of [390, 430, 768, 1024, 1280, 1440]) {
    const { page, errors, close } = await newContext({ viewport: { width, height: 900 }, signedIn: true });
    for (const [path, title] of pages) {
      await page.goto(`${APP}${path}`);
      await page.getByRole('heading', { name: title, level: 1 }).waitFor();
      await page.waitForLoadState('networkidle');
      await noOverflow(page, `${path} @${width}`);
      if (width === 390 || width === 1440) await axe(page, `${path} @${width}`);
    }
    assert.deepEqual(errors, []);
    await close();
  }
});

await step('dating profile: get_my_dating_profile_v5 fields and a signed photo URL', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/profile`);
  await page.getByText('Люблю долгие прогулки и джаз.').waitFor();
  assert(await page.getByText('Серьёзные отношения').isVisible());
  assert(await page.getByText('Москва, Россия').isVisible());
  assert(await page.getByRole('img', { name: 'Фотография 1' }).isVisible());
  assert(mock.state.calls.some((call) => call.path === `/storage/v1/object/sign/dating-photos/${USER_ID}/photos/1`));
  await close();
});

await step('Premium: active premium from get_my_entitlement, no store or payment source claimed', async () => {
  const { page, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/subscription`);
  await page.getByRole('heading', { name: 'Premium', level: 2 }).waitFor();
  await page.getByText(/Действует до 31 декабря 2026/).waitFor();
  const text = await bodyText(page);
  assert.doesNotMatch(text, /App Store|Google Play|магазин|оформлен/i);
  assert.doesNotMatch(text, /Exclusive/);
  await page.goto(`${APP}/account`);
  await page.locator('.profile-hero .chip-accent', { hasText: 'Premium' }).waitFor(); // plan badge
  await close();
});

await step('Premium: founder, free without entitlement row (is_premium null), expired premium', async () => {
  const cases = [
    [{ tier: 'founder', is_premium: true, premium_until: null }, 'Founder', /Бессрочный статус\./],
    [{ tier: 'free', is_premium: null, premium_until: null }, 'Free', /^Premium не активен\.$/m],
    [{ tier: 'free', is_premium: false, premium_until: '2026-01-31T00:00:00Z' }, 'Free', /Срок действия закончился 31 января 2026/],
  ];
  for (const [entitlement, label, status] of cases) {
    const { page, close } = await newContext({ signedIn: true, mockSetup: (state) => { state.entitlement = entitlement; } });
    await page.goto(`${APP}/account/subscription`);
    await page.getByRole('heading', { name: label, level: 2 }).waitFor();
    assert.match(await page.locator('.plan-panel').innerText(), status);
    if (label === 'Free') {
      await page.goto(`${APP}/account`);
      await page.getByRole('heading', { name: 'Обзор', level: 1 }).waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('.profile-hero .chip-accent').count(), 0, 'no plan badge when not active');
    }
    await close();
  }
});

await step('login methods: exactly what get_my_login_methods returns (incl. VK state), no VK/OAuth sign-in offered', async () => {
  const { page, close } = await newContext({
    signedIn: true,
    mockSetup: (state) => {
      state.loginMethods = [
        { provider: 'apple', connected: true, identityId: 'apple-identity', label: null },
        { provider: 'google', connected: false, identityId: null, label: null },
        { provider: 'vk', connected: true, identityId: null, label: 'Алиса VK' },
        { provider: 'email', connected: false, identityId: null, label: null },
      ];
    },
  });
  await page.goto(`${APP}/account/settings`);
  const row = (name) => page.locator('.list-row', { has: page.locator('.list-title', { hasText: new RegExp(`^${name}$`) }) });
  await row('Apple ID').getByText('Подключено', { exact: true }).waitFor();
  assert(await row('Google').getByText('Не подключено', { exact: true }).isVisible());
  assert(await row('VK ID').getByText('Подключено', { exact: true }).isVisible());
  assert(await row('VK ID').getByText('Алиса VK').isVisible());
  assert(await row('Почта').getByText('Не подключено', { exact: true }).isVisible());
  assert.equal(await page.locator('.list-row').count(), 4, 'one row per provider of the RPC');
  const text = await bodyText(page);
  assert.match(text, /Способы входа относятся к одному аккаунту, только если они уже связаны с ним\./);
  assert.match(text, /На сайте сейчас доступен вход по коду на почту\./);
  assert.equal(await page.getByRole('button', { name: /VK|Google|Apple/ }).count(), 0, 'no sign-in or linking buttons');
  await close();
});

await step('data export: export_my_account_data without arguments, saved as a local JSON file', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/settings`);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать копию данных' }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^ecoute-moi-data-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
  assert.equal(saved.account.id, USER_ID);
  await page.getByText('Файл с копией данных сохранён на этом устройстве.').waitFor();
  const call = mock.state.calls.find((item) => item.path === '/rest/v1/rpc/export_my_account_data');
  assert.deepEqual(call.body, {}, 'no user id or other argument is sent');
  await close();
});

await step('notifications: real preferences from the RPC; save sends exactly the eight server arguments', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/notifications`);
  const product = page.getByRole('switch', { name: 'Новости продукта' });
  await product.waitFor();
  assert.equal(await product.isChecked(), false);
  assert.equal(await page.getByRole('switch', { name: 'Сообщения' }).isChecked(), true);
  await product.check();
  await page.getByRole('radio', { name: 'Раз в день' }).check();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.getByText('Настройки сохранены. Они общие для приложения и сайта.').waitFor();
  const call = mock.state.calls.find((item) => item.path === '/rest/v1/rpc/update_my_notification_preferences_v1');
  assert.deepEqual(call.body, {
    p_messages_enabled: true, p_dating_enabled: true, p_product_enabled: true, p_quiet_hours_enabled: false,
    p_quiet_start: '22:00', p_quiet_end: '08:00', p_timezone: 'Europe/Moscow', p_delivery_mode: 'daily',
  });
  await page.reload();
  await page.getByRole('switch', { name: 'Новости продукта' }).waitFor();
  assert.equal(await page.getByRole('switch', { name: 'Новости продукта' }).isChecked(), true, 'saved state reloads from the server');
  await axe(page, '/account/notifications');
  await close();
});

await step('sessions: list from get_my_active_sessions; end the other sessions only', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/security`);
  const panel = page.locator('section[aria-labelledby="sessions-title"]');
  await panel.getByText('iPhone или iPad').waitFor();
  assert(await panel.getByText('Windows').isVisible());
  assert(await panel.getByText('Этот браузер').isVisible());
  assert(await panel.getByText('IP: 198.51.100.7').isVisible());
  const endOthers = page.getByRole('button', { name: 'Завершить другие сессии · 1' });
  await endOthers.click();
  await page.getByRole('dialog', { name: 'Завершить другие сессии?' }).getByRole('button', { name: 'Завершить' }).click();
  await page.getByText('Вход на других устройствах и в других браузерах завершён.').waitFor();
  assert(mock.state.calls.some((call) => call.path === '/auth/v1/logout' && call.search.includes('scope=others')));
  assert.notEqual(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY), null, 'this browser stays signed in');
  assert.equal(page.url(), `${APP}/account/security`);
  await close();
});

await step('safety centre: clear status and own reports from get_my_safety_center_v1', async () => {
  const { page, close } = await newContext({
    signedIn: true,
    mockSetup: (state) => {
      state.safety.recentReports = [{ id: 'r1', category: 'harassment', details: 'x', status: 'reviewing', contentType: 'message', createdAt: '2026-09-21T10:00:00Z' }];
    },
  });
  await page.goto(`${APP}/account/security`);
  await page.getByText('Активных ограничений нет').waitFor();
  await page.getByText('Оскорбления или преследование').waitFor();
  assert(await page.getByText('На рассмотрении').isVisible());
  assert.equal(await page.getByRole('textbox').count(), 0, 'no appeal form without an active sanction');
  await close();
});

await step('appeal: the sanction id comes from the server; the form never asks for it', async () => {
  const { page, mock, close } = await newContext({
    signedIn: true,
    mockSetup: (state) => {
      state.safety.accountStatus = 'suspended';
      state.safety.activeSanction = {
        id: SANCTION_ID, kind: 'suspended', reason: 'Нарушение правил сообщества.',
        startsAt: '2026-09-20T12:00:00Z', expiresAt: '2026-09-30T12:00:00Z', appeal: null,
      };
    },
  });
  await page.goto(`${APP}/account/security`);
  await page.getByText('Аккаунт приостановлен').waitFor();
  assert(await page.getByText('Нарушение правил сообщества.').isVisible());
  assert(await page.getByText(/Действует до: 30 сентября 2026/).isVisible());
  assert.equal(await page.getByRole('textbox').count(), 1, 'only the reason text field');
  assert.equal(await page.getByText(SANCTION_ID).count(), 0, 'the sanction id is never shown or typed');
  await page.getByRole('button', { name: 'Отправить обращение' }).click();
  await page.getByText('Опишите ситуацию текстом от 20 до 1500 символов.').waitFor();
  await page.getByLabel('Что важно учесть при повторной проверке?').fill('Прошу пересмотреть: сообщение было вырвано из контекста.');
  await page.getByRole('button', { name: 'Отправить обращение' }).click();
  await page.getByRole('dialog', { name: 'Отправить обращение?' }).getByRole('button', { name: 'Отправить' }).click();
  await page.getByText('Обращение отправлено. Статус появится здесь после рассмотрения.').waitFor();
  await page.getByText(/Обращение: Ожидает рассмотрения/).waitFor();
  const call = mock.state.calls.find((item) => item.path === '/rest/v1/rpc/submit_moderation_appeal');
  assert.deepEqual(call.body, { p_sanction_id: SANCTION_ID, p_reason: 'Прошу пересмотреть: сообщение было вырвано из контекста.' });
  await axe(page, '/account/security (sanction)');
  await close();
});

await step('blocked users: list from get_my_blocked_users; unblock via unblock_user after confirmation', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/blocked`);
  await page.getByText('Мария').waitFor();
  await page.getByRole('button', { name: 'Разблокировать: Анна' }).click();
  const dialog = page.getByRole('dialog', { name: 'Разблокировать пользователя?' });
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert(!mock.state.calls.some((call) => call.path === '/rest/v1/rpc/unblock_user'), 'Escape cancels');
  await page.getByRole('button', { name: 'Разблокировать: Анна' }).click();
  await dialog.getByRole('button', { name: 'Разблокировать' }).click();
  await page.getByText('Анна разблокирован(а).').waitFor();
  const call = mock.state.calls.find((item) => item.path === '/rest/v1/rpc/unblock_user');
  assert.deepEqual(call.body, { p_blocked_user_id: '11111111-1111-4111-8111-111111111111' });
  assert.equal(await page.getByRole('button', { name: 'Разблокировать: Анна' }).count(), 0);
  await close();
});

const deleteCalls = (mock) => mock.state.calls.filter((call) => call.path === '/functions/v1/delete-my-account');

async function startDeletionTimer(page) {
  await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
  await page.getByRole('dialog', { name: 'Удалить аккаунт?' }).getByRole('button', { name: 'Запустить таймер' }).click();
  await page.getByRole('timer').waitFor();
}

await step('delete account: confirm → three-minute timer → cancel sends nothing', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.clock.install();
  await page.goto(`${APP}/account/delete`);
  await page.getByRole('heading', { name: 'Удаление аккаунта', level: 1 }).waitFor();
  await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
  await page.getByRole('dialog', { name: 'Удалить аккаунт?' }).getByRole('button', { name: 'Не удалять' }).click();
  assert.equal(await page.getByRole('timer').count(), 0);
  await startDeletionTimer(page);
  assert.match(await page.getByRole('timer').innerText(), /3:00/);
  await page.clock.fastForward('01:30');
  assert.match(await page.getByRole('timer').innerText(), /1:30/);
  await page.getByRole('button', { name: 'Отменить удаление' }).click();
  await page.getByText('Удаление отменено. Аккаунт сохранён.').waitFor();
  await page.clock.fastForward('05:00');
  assert.equal(deleteCalls(mock).length, 0, 'cancelled deletion never reaches the Edge Function');
  await axe(page, '/account/delete');
  await close();
});

await step('delete account: Edge failure is never reported as success; retry then success clears the session', async () => {
  const { page, mock, errors, close } = await newContext({
    signedIn: true,
    mockSetup: (state) => { state.deleteMode = 'fail'; state.deleteDelayMs = 700; },
  });
  await page.clock.install();
  await page.goto(`${APP}/account/delete`);
  await startDeletionTimer(page);
  await page.clock.fastForward('03:01');
  await page.getByText('Удаляем аккаунт…').waitFor();
  await page.getByText('Удаление не подтверждено').waitFor();
  assert(await page.getByText(/Удаление не завершено\. Повторите попытку/).isVisible());
  assert.equal(page.url(), `${APP}/account/delete`, 'stays on the page after a failure');
  assert.equal(await page.getByRole('heading', { name: 'Аккаунт удалён' }).count(), 0, 'no false success');
  assert.notEqual(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY), null, 'session kept after failure');
  assert.equal(deleteCalls(mock).length, 1);
  assert.deepEqual(deleteCalls(mock)[0].body, { confirmation: 'delete-my-account' }, 'no user id is sent');

  mock.state.deleteMode = 'ok';
  await page.getByRole('button', { name: 'Повторить удаление' }).click();
  await page.waitForURL(`${APP}/account-deleted`);
  await page.getByRole('heading', { name: 'Аккаунт удалён', level: 1 }).waitFor();
  await page.waitForFunction((key) => window.localStorage.getItem(key) === null, STORAGE_KEY);
  assert.doesNotMatch(await bodyText(page), /Алиса|tester@example\.com/, 'no private data on the confirmation page');
  await page.goto(`${APP}/account/security`);
  await page.waitForURL(`${APP}/login`);
  assert.deepEqual(mock.state.callsAfterDeletion, [], 'no account RPC is called after the deletion succeeded');
  assert.deepEqual(errors, []);
  await close();
});

await step('account-deleted page is public, shows no account data and makes no backend request', async () => {
  const { page, mock, close } = await newContext();
  await page.goto(`${APP}/account-deleted`);
  await page.getByRole('heading', { name: 'Аккаунт удалён', level: 1 }).waitFor();
  await page.waitForLoadState('networkidle');
  assert.equal(mock.state.calls.filter((call) => call.path?.startsWith('/rest/') || call.path?.startsWith('/functions/')).length, 0);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow');
  await axe(page, '/account-deleted');
  await close();
});

await step('mobile navigation: menu button, aria-expanded, Escape and link navigation', async () => {
  const { page, close } = await newContext({ viewport: { width: 390, height: 844 }, signedIn: true });
  await page.goto(`${APP}/account`);
  const menu = page.getByRole('button', { name: 'Меню', exact: true });
  await menu.waitFor();
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  const drawer = page.getByRole('dialog', { name: 'Меню личного кабинета' });
  await drawer.waitFor();
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  await menu.click();
  await drawer.getByRole('link', { name: 'Безопасность' }).click();
  await page.waitForURL(`${APP}/account/security`);
  await drawer.waitFor({ state: 'hidden' });
  await noOverflow(page, 'security @390 after drawer');
  await close();
});

await step('logout: confirmation, local session cleared, private routes protected again', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account`);
  await page.getByRole('heading', { name: 'Обзор', level: 1 }).waitFor();
  await page.locator('.sidebar').getByRole('button', { name: 'Выйти' }).click();
  await page.getByRole('dialog', { name: 'Выйти из аккаунта?' }).getByRole('button', { name: 'Выйти' }).click();
  await page.waitForURL(`${APP}/login`);
  await page.getByText('Вы вышли из аккаунта').waitFor();
  assert(mock.state.calls.some((call) => call.path === '/auth/v1/logout' && call.search.includes('scope=local')));
  assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY), null);
  await page.goto(`${APP}/account/profile`);
  await page.waitForURL(`${APP}/login`);
  await close();
});

await step('profile check failure keeps the session and shows a recoverable error (no blank screen)', async () => {
  const { page, mock, close } = await newContext({ signedIn: true, mockSetup: (state) => { state.datingProfileFails = true; } });
  await page.goto(`${APP}/account`);
  await page.getByText('Профиль временно недоступен').waitFor();
  assert(await page.getByRole('heading', { name: 'Обзор', level: 1 }).isVisible());
  mock.state.datingProfileFails = false;
  await page.getByRole('button', { name: 'Повторить' }).first().click();
  await page.getByText('Профиль временно недоступен').waitFor({ state: 'hidden' });
  await close();
});

await step('onboarding required: account works, banner explains app onboarding, no fake profile', async () => {
  const { page, close } = await newContext({ signedIn: true, mockSetup: (state) => { state.onboardingComplete = false; } });
  await page.goto(`${APP}/account/profile`);
  await page.getByText('Завершите создание профиля в приложении Écoute Moi').waitFor();
  await page.getByText('Анкета ещё не заполнена').waitFor();
  await close();
});

await step('auth callback: cancelled, provider error, invalid code, implicit tokens rejected', async () => {
  const { page, close } = await newContext();
  await page.goto(`${APP}/auth/callback?error=access_denied&error_description=User%20cancelled`);
  await page.getByRole('heading', { name: 'Вход отменён' }).waitFor();
  assert.equal(new URL(page.url()).search, '', 'callback parameters removed from the address bar');
  await page.goto(`${APP}/auth/callback?error=server_error&error_description=%3Cscript%3Ealert(1)%3C%2Fscript%3E`);
  await page.getByRole('heading', { name: 'Не удалось войти' }).waitFor();
  assert.equal(await page.locator('script', { hasText: 'alert(1)' }).count(), 0, 'error text never injected as HTML');
  assert.equal(await page.getByText('alert(1)').count(), 0, 'raw provider error is not displayed');
  await page.goto(`${APP}/auth/callback?code=abcdefgh-1234-invalid`);
  await page.getByText(/Ссылка устарела или открыта в другом браузере/).waitFor();
  await page.goto(`${APP}/auth/callback#access_token=forged&refresh_token=forged`);
  await page.getByRole('heading', { name: 'Не удалось войти' }).waitFor();
  assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY), null, 'no session from forged tokens');
  await close();
});

await step('auth callback: email token_hash link signs in; recovery link forces new password', async () => {
  const first = await newContext();
  await first.page.goto(`${APP}/auth/callback?token_hash=valid-token-hash-1234&type=email`);
  await first.page.waitForURL(`${APP}/voices`);
  await first.close();

  const { page, mock, close } = await newContext();
  await page.goto(`${APP}/auth/callback?token_hash=valid-token-hash-1234&type=recovery`);
  await page.waitForURL(`${APP}/auth/reset-password`);
  await page.goto(`${APP}/account`);
  await page.waitForURL(`${APP}/auth/reset-password`); // recovery survives reload and blocks the shell
  await page.getByLabel('Новый пароль').fill('short');
  await page.getByLabel('Повторите пароль').fill('short');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await page.getByText('Пароль должен содержать не менее 8 символов, буквы и цифры.').waitFor();
  await page.getByLabel('Новый пароль').fill('newpass2026');
  await page.getByLabel('Повторите пароль').fill('newpass2026');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await page.waitForURL(`${APP}/account`);
  assert(mock.state.calls.some((call) => call.path === '/auth/v1/user' && call.method === 'PUT' && call.body.password === 'newpass2026'));
  await close();
});

await step('reset-password without a recovery session shows an explanation', async () => {
  const { page, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/auth/reset-password`);
  await page.getByRole('heading', { name: 'Ссылка недействительна' }).waitFor();
  await close();
});

await step('unknown route shows 404 page; app never requests third-party hosts', async () => {
  const { page, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/definitely-missing`);
  await page.getByRole('heading', { name: 'Здесь пока тихо.' }).waitFor();
  await page.goto(`${APP}/account`);
  await page.waitForLoadState('networkidle');
  await close();
});

await step('product flow: voice response, resonance reveal, mutuality, chat send', async () => {
  const { page, mock, close } = await newContext({ signedIn: true, mockSetup: (state) => {
    state.reciprocalInterest = true;
    state.reciprocalPhotoInterest = true;
    state.voices = [{ impression_id: IMPRESSION_ID, prompt_key: 'good_day', audio_path: `${CONTACT_ID}/voice`, audio_duration_seconds: 30, age: 31, city: 'Москва', relationship_goal: 'serious', shared_interests: ['книги'] }];
  } });
  await page.goto(`${APP}/voices`);
  await page.getByRole('heading', { name: 'Что вас вдохновляет?' }).waitFor();
  for (const width of [390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page, `/voices ${width}px`);
  }
  await axe(page, '/voices');
  assert.equal(await page.locator('.voice-card img').count(), 0, 'photos stay hidden before resonance');
  await page.getByRole('button', { name: 'Отклик' }).click();
  await page.goto(`${APP}/resonances`);
  await page.getByRole('heading', { name: 'Мария' }).waitFor();
  await page.locator('.product-photos img').waitFor();
  await noOverflow(page, '/resonances');
  await axe(page, '/resonances');
  await page.getByRole('button', { name: 'Хочу продолжить' }).click();
  await page.getByRole('link', { name: 'Открыть чат' }).waitFor();
  await page.getByRole('link', { name: 'Открыть чат' }).click();
  await noOverflow(page, '/chats/:conversationId');
  await axe(page, '/chats/:conversationId');
  await page.getByLabel('Сообщение').fill('Привет!');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await page.getByText('Привет!', { exact: true }).waitFor();
  assert(mock.state.messages.some((item) => item.body === 'Привет!' && item.conversation_id === CONVERSATION_ID));
  await close();
});

await step('mobile-created resonance and chat appear on web; foreign chat and resonance denied', async () => {
  const { page, mock, close } = await newContext({ signedIn: true, mockSetup: (state) => {
    state.resonances = [{ resonance_id: RESONANCE_ID, contact_id: CONTACT_ID, display_name: 'Мария', about: 'Люблю книги', age: 31, city: 'Москва', relationship_goal: 'serious', interests: ['книги'], photo_paths: [], my_photo_decision: 'interest', stage: 'mutuality', conversation_id: CONVERSATION_ID, resonated_at: '2026-09-24T11:00:00Z' }];
    state.conversations = [{ conversation_id: CONVERSATION_ID, contact_id: CONTACT_ID, contact_name: 'Мария', contact_avatar_path: null, last_message_text: 'Сообщение с телефона', last_message_at: '2026-09-24T11:01:00Z', unread_count: 1, blocked_by_me: false, blocked_by_contact: false, lifecycle_status: 'active', comfort_state: 'normal', contact_restricted: false }];
    state.messages = [{ id: '99999999-9999-4999-8999-999999999999', conversation_id: CONVERSATION_ID, sender_id: CONTACT_ID, body: 'Сообщение с телефона', message_type: 'text', media_path: null, deleted_for_everyone_at: null, created_at: '2026-09-24T11:01:00Z' }];
  } });
  await page.goto(`${APP}/resonances`);
  await page.getByRole('heading', { name: 'Мария' }).waitFor();
  await page.goto(`${APP}/chats`);
  await page.getByText('Сообщение с телефона').waitFor();
  await page.goto(`${APP}/chats/${CONVERSATION_ID}`);
  await page.getByText('Сообщение с телефона').waitFor();
  await page.goto(`${APP}/chats/${FOREIGN_CONVERSATION_ID}`);
  await page.getByText('Доступ к разговору закрыт.').waitFor();
  assert(!mock.state.calls.some((call) => call.path === '/rest/v1/messages' && call.search.includes(FOREIGN_CONVERSATION_ID)), 'foreign messages were not queried');
  const foreignResonanceStatus = await page.evaluate(async (url) => (await fetch(`${url}/rest/v1/rpc/respond_to_photo_resonance`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ p_resonance_id: '00000000-0000-4000-8000-000000000001', p_interested: true }),
  })).status, SUPABASE_URL);
  assert.equal(foreignResonanceStatus, 403);
  await close();
});

await step('chat retry uses one client id; pagination, ordering, block and closed state', async () => {
  const { page, mock, close } = await newContext({ signedIn: true, mockSetup: (state) => {
    state.conversations = [{ conversation_id: CONVERSATION_ID, contact_id: CONTACT_ID, contact_name: 'Мария', contact_avatar_path: null, last_message_text: null, last_message_at: '2026-09-24T11:00:00Z', unread_count: 0, blocked_by_me: false, blocked_by_contact: false, lifecycle_status: 'active', comfort_state: 'normal', contact_restricted: false }];
    state.messages = Array.from({ length: 35 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, conversation_id: CONVERSATION_ID, sender_id: CONTACT_ID, body: `История ${i + 1}`, message_type: 'text', media_path: null, deleted_for_everyone_at: null, created_at: new Date(Date.UTC(2026, 8, 24, 11, i)).toISOString() }));
    state.failNextSend = true;
  } });
  await page.goto(`${APP}/chats/${CONVERSATION_ID}`);
  await page.getByText('История 35').waitFor();
  assert.equal(await page.locator('.message-list li').count(), 30);
  await page.getByRole('button', { name: 'Ранние сообщения' }).click();
  await page.getByText('История 1', { exact: true }).waitFor();
  assert.equal(await page.locator('.message-list li').count(), 35);
  await page.getByLabel('Сообщение').fill('Повтор после ошибки');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await page.getByRole('button', { name: 'Повторить отправку' }).waitFor();
  await page.getByRole('button', { name: 'Повторить отправку' }).click();
  await page.getByText('Повтор после ошибки', { exact: true }).waitFor();
  const inserts = mock.state.calls.filter((call) => call.method === 'POST' && call.path === '/rest/v1/messages');
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].body.client_message_id, inserts[1].body.client_message_id);
  assert.equal(mock.state.messages.filter((item) => item.body === 'Повтор после ошибки').length, 1);
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Заблокировать' }).click();
  await page.getByText('Разговор приостановлен. История доступна только для чтения.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Отправить', exact: true }).count(), 0);
  mock.state.conversations = mock.state.conversations.map((item) => ({ ...item, blocked_by_me: false, lifecycle_status: 'ended' }));
  await page.reload();
  await page.getByText('Разговор приостановлен. История доступна только для чтения.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Отправить', exact: true }).count(), 0);
  await close();
});

await step('own voice recording reuses the existing profile and private audio bucket', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.addInitScript(() => {
    const originalNow = Date.now;
    Date.now = () => originalNow() + (window.__e2eTimeOffset ?? 0);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    window.MediaRecorder = class {
      static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
      state = 'inactive';
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice-fixture'], { type: 'audio/webm' }) }); this.onstop?.(); }
    };
  });
  await page.goto(`${APP}/voices/record`);
  await page.getByRole('button', { name: 'Начать запись' }).click();
  await page.evaluate(() => { window.__e2eTimeOffset = 21000; });
  await page.getByRole('button', { name: 'Остановить' }).click();
  await page.getByRole('button', { name: 'Опубликовать аудиописьмо' }).click();
  await page.getByText('Аудиописьмо сохранено.').waitFor();
  const saved = mock.state.calls.find((call) => call.path === '/rest/v1/rpc/save_my_dating_profile');
  assert(saved);
  assert.equal(saved.body.p_audio_duration_seconds, 21);
  assert.deepEqual(saved.body.p_photo_paths, [`${USER_ID}/photos/1`]);
  assert.equal(saved.body.p_display_name, 'Алиса');
  assert(mock.state.audioUploaded, 'audio uses the private dating-audio bucket');
  await close();
});

await browser.close();
await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
console.log(`\n${results.length - failures}/${results.length} E2E checks passed.`);
if (failures) process.exit(1);
