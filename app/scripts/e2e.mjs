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
  'get_my_dating_profile_v5',
  'get_my_entitlement',
  'get_my_account_restriction',
  'get_my_blocked_users',
  'unblock_user',
]);
const VERIFIED_TABLES = new Set(['profiles', 'dating_profiles', 'privacy_settings']);
const VERIFIED_BUCKETS = new Set(['dating-photos', 'dating-audio']);

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
    // get_my_account_restriction() returns zero or one row: (sanction, reason, expires_at).
    restriction: null,
    blocked: [
      { user_id: '11111111-1111-4111-8111-111111111111', display_name: 'Анна', blocked_at: '2026-09-10T12:00:00Z' },
      { user_id: '22222222-2222-4222-8222-222222222222', display_name: 'Мария', blocked_at: '2026-09-11T12:00:00Z' },
    ],
    calls: [],
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
    if (path === '/auth/v1/user') return json(route, 200, makeUser('tester@example.com', state.identities), cors);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });

    // ---- PostgREST RPC: verified functions only
    if (path.startsWith('/rest/v1/rpc/')) {
      const rpc = path.slice('/rest/v1/rpc/'.length);
      if (!VERIFIED_RPCS.has(rpc)) return unverified();
      switch (rpc) {
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
        case 'get_my_account_restriction':
          return json(route, 200, state.restriction ? [state.restriction] : [], cors);
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

    // Edge Functions and anything else: no verified contract exists.
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
  await page.waitForURL(`${APP}/account`);
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
  await page.waitForURL(`${APP}/account`);
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

await step('login methods: Supabase identities only; VK shows an informational state, never connected/not connected', async () => {
  const { page, close } = await newContext({
    signedIn: true,
    mockSetup: (state) => { state.identities = [identity('email'), identity('google')]; },
  });
  await page.goto(`${APP}/account/settings`);
  const row = (name) => page.locator('.list-row', { has: page.locator('.list-title', { hasText: new RegExp(`^${name}$`) }) });
  await row('Почта').getByText('Подключено', { exact: true }).waitFor();
  assert(await row('Почта').getByText('tester@example.com').isVisible());
  assert(await row('Google').getByText('Подключено', { exact: true }).isVisible());
  assert(await row('Apple ID').getByText('Не подключено', { exact: true }).isVisible());
  assert(await row('Телефон').getByText('Не подключено', { exact: true }).isVisible());
  assert(await row('VK ID').getByText('Нет данных', { exact: true }).isVisible());
  assert(await row('VK ID').getByText('Сайт не может проверить этот способ входа.').isVisible());
  assert.equal(await row('VK ID').getByText(/Подключено|Не подключено/).count(), 0);
  const text = await bodyText(page);
  assert.match(text, /Способы входа относятся к одному аккаунту, только если они уже связаны с ним\./);
  assert.doesNotMatch(text, /никогда не объединяет/);
  await close();
});

await step('unsupported sections show honest fallbacks: export, notifications, sessions', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/settings`);
  await page.getByText('Экспорт данных через веб пока недоступен.').waitFor();
  assert.equal(await page.getByRole('button', { name: /Скачать/ }).count(), 0);

  await page.goto(`${APP}/account/notifications`);
  await page.getByText('Настройки уведомлений сейчас доступны в мобильном приложении Écoute Moi.').waitFor();
  assert.equal(await page.getByRole('switch').count(), 0, 'no fake switches');
  assert.equal(await page.getByRole('radio').count(), 0);
  assert.equal(await page.getByRole('button', { name: /Сохранить/ }).count(), 0, 'no save button');

  await page.goto(`${APP}/account/security`);
  await page.getByText('Просмотр активных сессий на сайте пока недоступен.').waitFor();
  const sessionsPanel = page.locator('section[aria-labelledby="sessions-title"]');
  assert.equal(await sessionsPanel.locator('ul, li').count(), 0, 'no fake session list');
  assert.equal(await page.getByText(/Последняя активность|IP:/).count(), 0, 'no fake session details');
  const endOthers = page.getByRole('button', { name: 'Завершить другие сессии' });
  assert.equal(await endOthers.innerText(), 'Завершить другие сессии', 'no invented session count');
  await endOthers.click();
  await page.getByRole('dialog', { name: 'Завершить другие сессии?' }).getByRole('button', { name: 'Завершить' }).click();
  await page.getByText('Вход на других устройствах и в других браузерах завершён.').waitFor();
  assert(mock.state.calls.some((call) => call.path === '/auth/v1/logout' && call.search.includes('scope=others')));
  assert.notEqual(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY), null, 'this browser stays signed in');
  assert.equal(page.url(), `${APP}/account/security`);
  await close();
});

await step('account status: get_my_account_restriction, no appeal form without a sanction id', async () => {
  const clear = await newContext({ signedIn: true });
  await clear.page.goto(`${APP}/account/security`);
  await clear.page.getByText('Активных ограничений нет').waitFor();
  await clear.close();

  const { page, close } = await newContext({
    signedIn: true,
    mockSetup: (state) => {
      state.restriction = { sanction: 'suspended', reason: 'Нарушение правил сообщества.', expires_at: '2026-09-30T12:00:00Z' };
    },
  });
  await page.goto(`${APP}/account/security`);
  await page.getByText('Аккаунт приостановлен').waitFor();
  assert(await page.getByText('Нарушение правил сообщества.').isVisible());
  assert(await page.getByText(/Действует до: 30 сентября 2026/).isVisible());
  assert(await page.getByText(/Обжаловать ограничение через сайт пока нельзя/).isVisible());
  assert.equal(await page.getByRole('textbox').count(), 0, 'no appeal form and no manual sanction id');
  assert.doesNotMatch(await bodyText(page), /Мои жалобы/);
  await axe(page, '/account/security (restricted)');
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

await step('delete account: no deletion backend, so no destructive control and no request', async () => {
  const { page, mock, close } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/delete`);
  await page.getByText('Удаление аккаунта через сайт пока недоступно.').first().waitFor();
  assert.equal(await page.getByRole('button', { name: /Удалить/ }).count(), 0, 'no delete button');
  assert.equal(await page.getByRole('timer').count(), 0, 'no deletion timer');
  const link = page.getByRole('link', { name: 'Открыть страницу «Удаление аккаунта»' });
  assert.equal(await link.getAttribute('href'), 'https://ecoutemoi.ru/account-deletion/');
  await page.waitForLoadState('networkidle');
  assert(!mock.state.calls.some((call) => call.path?.startsWith('/functions/v1/')), 'no Edge Function call');
  await page.goto(`${APP}/account-deleted`);
  await page.getByRole('heading', { name: 'Здесь пока тихо.' }).waitFor(); // no false "account deleted" page
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
  await first.page.waitForURL(`${APP}/account`);
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

await browser.close();
await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
console.log(`\n${results.length - failures}/${results.length} E2E checks passed.`);
if (failures) process.exit(1);
