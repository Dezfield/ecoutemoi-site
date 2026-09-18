// End-to-end browser checks of the built web app against a MOCKED Supabase
// backend (Playwright request interception). No real project, account,
// email or credential is used: the fake project URL is never reachable.
//
//   npm run test:e2e
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
const DIST = resolve('dist-e2e');

// ---------------------------------------------------------------- build
if (!process.env.E2E_SKIP_BUILD) {
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: 'e2e-publishable-key',
      VITE_PUBLIC_SITE_URL: 'https://ecoutemoi.ru',
      VITE_AUTH_OAUTH_PROVIDERS: 'google',
    },
  });
}

// ---------------------------------------------------------------- mock backend
const USER_ID = '5f1c7a3e-2b4d-4c6e-8a9b-0c1d2e3f4a5b';
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const nowSeconds = () => Math.floor(Date.now() / 1000);

function makeUser(email) {
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
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
    blocked: [
      { user_id: '11111111-1111-4111-8111-111111111111', display_name: 'Анна', blocked_at: '2026-09-10T12:00:00Z' },
      { user_id: '22222222-2222-4222-8222-222222222222', display_name: 'Мария', blocked_at: '2026-09-11T12:00:00Z' },
    ],
    notifications: {
      messagesEnabled: true, datingEnabled: true, productEnabled: false, quietHoursEnabled: false,
      quietStart: '22:00', quietEnd: '08:00', timezone: 'Europe/Moscow', deliveryMode: 'instant', safetyAlwaysOn: true,
      updatedAt: null,
    },
    calls: [],
  };

  const cors = {
    'access-control-allow-origin': APP,
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': '*',
  };

  const json = (route, status, body) =>
    route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: body === undefined ? '' : JSON.stringify(body) });

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname;
    let body = {};
    try { body = request.postDataJSON() ?? {}; } catch { body = {}; }
    state.calls.push({ method, path, search: url.search, body });

    // ---- Auth
    if (path === '/auth/v1/otp') return json(route, 200, {});
    if (path === '/auth/v1/verify') {
      if (body.token_hash) {
        if (body.token_hash === 'valid-token-hash-1234') return json(route, 200, makeSession());
        return json(route, 403, { code: 'otp_expired', msg: 'Email link is invalid or has expired' });
      }
      if (body.token === '123456') return json(route, 200, makeSession(body.email));
      return json(route, 403, { code: 'otp_expired', error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    }
    if (path === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') return json(route, 200, makeSession());
      return json(route, 400, { code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' });
    }
    if (path === '/auth/v1/user') {
      if (method === 'PUT') return json(route, 200, makeUser('tester@example.com'));
      return json(route, 200, makeUser('tester@example.com'));
    }
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });

    // ---- REST tables (own rows only)
    if (path === '/rest/v1/profiles') return json(route, 200, [{ id: USER_ID, display_name: 'Алиса', created_at: '2026-09-01T10:00:00Z' }]);
    if (path === '/rest/v1/dating_profiles') {
      if (state.datingProfileFails) return json(route, 500, { code: 'XX000', message: 'internal error' });
      return json(route, 200, state.onboardingComplete ? [{ onboarding_complete: true }] : []);
    }
    if (path === '/rest/v1/privacy_settings') return json(route, 200, [{ nearby_opt_in: false }]);

    // ---- RPC
    const rpc = path.startsWith('/rest/v1/rpc/') ? path.slice('/rest/v1/rpc/'.length) : null;
    switch (rpc) {
      case 'get_my_dating_profile_v5':
        return json(route, 200, state.onboardingComplete ? [{
          display_name: 'Алиса', about: 'Люблю долгие прогулки и джаз.', birth_date: '1996-03-14', city: 'Москва',
          country_code: 'RU', gender_code: 'woman', looking_for: ['man'], relationship_goal: 'serious',
          interests: ['музыка', 'книги'], languages: ['ru', 'en'], preferred_min_age: 27, preferred_max_age: 40,
          audio_prompt_key: 'good_day', audio_path: null, audio_duration_seconds: 32,
          photo_paths: [`${USER_ID}/photos/1`], onboarding_complete: true, discovery_enabled: true,
          profile_values: ['честность'], children_preference: 'open', smoking_code: 'never', alcohol_code: 'occasionally',
          communication_pace: 'balanced', what_matters: '', zodiac_sign: 'pisces',
        }] : []);
      case 'get_my_store_subscription_v1':
        return json(route, 200, [{ tier: 'premium', active: true, premium_until: '2026-12-31T00:00:00Z', source: 'store', store_platform: 'apple', store_product_id: 'ecoute_premium_monthly', store_feature_available: false }]);
      case 'get_my_login_methods':
        return json(route, 200, [
          { provider: 'apple', connected: false, identityId: null, label: null },
          { provider: 'google', connected: false, identityId: null, label: null },
          { provider: 'vk', connected: false, identityId: null, label: null },
          { provider: 'email', connected: true, identityId: 'id-email', label: 'tester@example.com' },
        ]);
      case 'get_my_active_sessions':
        return json(route, 200, [
          { session_id: 'sess-current', created_at: '2026-09-18T10:00:00Z', updated_at: '2026-09-18T12:00:00Z', user_agent: 'Mozilla/5.0 (Windows NT 10.0)', ip_address: '203.0.113.5', current_session: true },
          { session_id: 'sess-phone', created_at: '2026-09-17T10:00:00Z', updated_at: '2026-09-17T12:00:00Z', user_agent: 'Mozilla/5.0 (iPhone)', ip_address: null, current_session: false },
        ]);
      case 'get_my_blocked_users':
        return json(route, 200, state.blocked);
      case 'unblock_user':
        state.blocked = state.blocked.filter((item) => item.user_id !== body.p_blocked_user_id);
        return route.fulfill({ status: 204, headers: cors });
      case 'get_my_notification_preferences_v1':
        return json(route, 200, state.notifications);
      case 'update_my_notification_preferences_v1':
        state.notifications = {
          ...state.notifications,
          messagesEnabled: body.p_messages_enabled, datingEnabled: body.p_dating_enabled, productEnabled: body.p_product_enabled,
          quietHoursEnabled: body.p_quiet_hours_enabled, quietStart: body.p_quiet_start, quietEnd: body.p_quiet_end,
          timezone: body.p_timezone, deliveryMode: body.p_delivery_mode, updatedAt: new Date().toISOString(),
        };
        return json(route, 200, state.notifications);
      case 'get_my_safety_center_v1':
        return json(route, 200, { accountStatus: 'clear', activeSanction: null, recentReports: [], recentAppeals: [], hasMoreReports: false });
      case 'export_my_account_data':
        return json(route, 200, { formatVersion: 1, account: { id: USER_ID } });
      case null:
        break;
      default:
        return json(route, 404, { code: 'PGRST202', message: `Could not find the function public.${rpc}` });
    }

    // ---- Storage and functions
    if (path.startsWith('/storage/v1/object/sign/')) {
      if (method === 'POST') return json(route, 200, { signedURL: `${path.replace('/storage/v1', '')}?token=e2e` });
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: PNG_1PX });
    }
    if (path === '/functions/v1/delete-my-account') {
      const auth = request.headers().authorization ?? '';
      if (!auth.startsWith('Bearer ') || body.confirmation !== 'delete-my-account') return json(route, 401, { error: 'authentication_required' });
      return json(route, 200, { deleted: true });
    }
    return json(route, 404, { message: `unmocked ${method} ${path}` });
  }

  return { state, handle };
}

// ---------------------------------------------------------------- runner
const server = await startServer(PORT, DIST);
const executablePath = process.env.E2E_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ headless: true, executablePath, channel: executablePath ? undefined : process.env.E2E_BROWSER_CHANNEL });

const results = [];
let failures = 0;

async function newContext({ viewport = { width: 1280, height: 900 }, signedIn = false, mockSetup } = {}) {
  const mock = createMock();
  mockSetup?.(mock.state);
  const context = await browser.newContext({ viewport, locale: 'ru-RU', timezoneId: 'Europe/Moscow' });
  await context.route(`${SUPABASE_URL}/**`, (route) => mock.handle(route));
  // Any other external request must not happen (fonts excepted: none are used).
  await context.route((url) => !url.href.startsWith(APP) && !url.href.startsWith(SUPABASE_URL), (route) => {
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
  return { context, page, mock, errors };
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

console.log('Web app E2E (mocked Supabase)');

await step('login page: renders, no private data, no overflow, axe clean (390 & 1440)', async () => {
  for (const width of [390, 1440]) {
    const { context, page, errors } = await newContext({ viewport: { width, height: 900 } });
    await page.goto(`${APP}/login`);
    await page.getByRole('heading', { name: 'Добро пожаловать' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Продолжить с Google' }).count(), 1, 'enabled provider shown');
    assert.equal(await page.getByRole('button', { name: /Apple|VK/ }).count(), 0, 'disabled providers must not be buttons');
    assert(await page.getByText(/Вход через Apple и VK на сайте появится позже/).isVisible());
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow');
    await noOverflow(page, `/login @${width}`);
    await axe(page, `/login @${width}`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

await step('protected route: /account without session redirects to /login', async () => {
  const { context, page } = await newContext();
  await page.goto(`${APP}/account/security`);
  await page.waitForURL(`${APP}/login`);
  assert.equal(await page.getByText('Активные сессии').count(), 0, 'no private content');
  await context.close();
});

await step('email OTP: wrong code error, correct code signs in and returns to the requested page', async () => {
  const { context, page, mock, errors } = await newContext();
  await page.goto(`${APP}/account/notifications`);
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
  await page.waitForURL(`${APP}/account/notifications`);
  await page.getByRole('heading', { name: 'Уведомления', level: 1 }).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

await step('signup page asks the server to create the account (create_user=true)', async () => {
  const { context, page, mock } = await newContext();
  await page.goto(`${APP}/signup`);
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').waitFor();
  const otp = mock.state.calls.find((call) => call.path === '/auth/v1/otp');
  assert.equal(otp.body.create_user, true);
  await context.close();
});

await step('session restore after reload + account overview with real data', async () => {
  const { context, page, errors } = await newContext();
  await page.goto(`${APP}/login`);
  await loginWithCode(page);
  await page.waitForURL(`${APP}/account`);
  await page.getByText('Алиса').first().waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Обзор', level: 1 }).waitFor();
  await page.locator('.profile-hero-age', { hasText: '30 лет' }).waitFor(); // age computed from birth date
  assert(await page.locator('.profile-hero .chip-accent').getByText('Premium').isVisible(), 'plan badge');
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  assert(stored && JSON.parse(stored).access_token, 'session persisted by supabase-js');
  assert.deepEqual(errors, []);
  await context.close();
});

await step('account sections render real data and are responsive (390–1440) and axe clean', async () => {
  const pages = [
    ['/account', 'Обзор'],
    ['/account/profile', 'Профиль'],
    ['/account/settings', 'Аккаунт и вход'],
    ['/account/privacy', 'Конфиденциальность'],
    ['/account/notifications', 'Уведомления'],
    ['/account/subscription', 'Premium / Exclusive'],
    ['/account/security', 'Безопасность'],
    ['/account/blocked', 'Заблокированные пользователи'],
    ['/account/support', 'Поддержка'],
    ['/account/legal', 'Документы'],
    ['/account/delete', 'Удалить аккаунт'],
  ];
  for (const width of [390, 430, 768, 1024, 1280, 1440]) {
    const { context, page, errors } = await newContext({ viewport: { width, height: 900 }, signedIn: true });
    for (const [path, title] of pages) {
      await page.goto(`${APP}${path}`);
      await page.getByRole('heading', { name: title, level: 1 }).waitFor();
      await page.waitForLoadState('networkidle');
      await noOverflow(page, `${path} @${width}`);
      if (width === 390 || width === 1440) await axe(page, `${path} @${width}`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});

await step('profile, settings, subscription, security show backend values', async () => {
  const { context, page } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/profile`);
  await page.getByText('Люблю долгие прогулки и джаз.').waitFor();
  assert(await page.getByText('Серьёзные отношения').isVisible());
  assert(await page.getByRole('img', { name: 'Фотография 1' }).isVisible());
  await page.goto(`${APP}/account/settings`);
  await page.getByText('Не подключено').first().waitFor();
  assert(await page.locator('.list-row', { hasText: 'Почта' }).getByText('Подключено', { exact: true }).isVisible());
  await page.goto(`${APP}/account/subscription`);
  await page.getByText(/Подписка оформлена через App Store/).waitFor();
  await page.goto(`${APP}/account/security`);
  await page.getByText('Ограничений нет').waitFor();
  assert(await page.getByText('Этот браузер').isVisible());
  assert(await page.getByRole('button', { name: 'Завершить другие сессии · 1' }).isEnabled());
  await context.close();
});

await step('notifications: toggles are real and saved through the RPC', async () => {
  const { context, page, mock } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/notifications`);
  const product = page.getByRole('switch', { name: 'Новости продукта' });
  await product.waitFor();
  assert.equal(await product.isChecked(), false);
  await product.check();
  await page.getByRole('radio', { name: 'Раз в день' }).check();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.getByText('Настройки сохранены').waitFor();
  const call = mock.state.calls.find((item) => item.path === '/rest/v1/rpc/update_my_notification_preferences_v1');
  assert.equal(call.body.p_product_enabled, true);
  assert.equal(call.body.p_delivery_mode, 'daily');
  assert.equal(call.body.p_timezone, 'Europe/Moscow');
  await context.close();
});

await step('blocked users: unblock goes through unblock_user RPC after confirmation', async () => {
  const { context, page, mock } = await newContext({ signedIn: true });
  await page.goto(`${APP}/account/blocked`);
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
  assert.equal(call.body.p_blocked_user_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(await page.getByRole('button', { name: 'Разблокировать: Анна' }).count(), 0);
  await context.close();
});

await step('mobile navigation: menu button, aria-expanded, Escape and link navigation', async () => {
  const { context, page } = await newContext({ viewport: { width: 390, height: 844 }, signedIn: true });
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
  await context.close();
});

await step('logout: confirmation, local session cleared, private routes protected again', async () => {
  const { context, page, mock } = await newContext({ signedIn: true });
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
  await context.close();
});

await step('profile check failure keeps the session and shows a recoverable error (no blank screen)', async () => {
  const { context, page, mock } = await newContext({ signedIn: true, mockSetup: (state) => { state.datingProfileFails = true; } });
  await page.goto(`${APP}/account`);
  await page.getByText('Профиль временно недоступен').waitFor();
  assert(await page.getByRole('heading', { name: 'Обзор', level: 1 }).isVisible());
  mock.state.datingProfileFails = false;
  await page.getByRole('button', { name: 'Повторить' }).first().click();
  await page.getByText('Профиль временно недоступен').waitFor({ state: 'hidden' });
  await context.close();
});

await step('onboarding required: account works, banner explains app onboarding, no fake profile', async () => {
  const { context, page } = await newContext({ signedIn: true, mockSetup: (state) => { state.onboardingComplete = false; } });
  await page.goto(`${APP}/account/profile`);
  await page.getByText('Завершите создание профиля в приложении Écoute Moi').waitFor();
  await page.getByText('Анкета ещё не заполнена').waitFor();
  await context.close();
});

await step('auth callback: cancelled, provider error, invalid code, implicit tokens rejected', async () => {
  const { context, page } = await newContext();
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
  await context.close();
});

await step('auth callback: email token_hash link signs in; recovery link forces new password', async () => {
  const { context, page, mock } = await newContext();
  await page.goto(`${APP}/auth/callback?token_hash=valid-token-hash-1234&type=email`);
  await page.waitForURL(`${APP}/account`);
  await context.close();

  const second = await newContext();
  await second.page.goto(`${APP}/auth/callback?token_hash=valid-token-hash-1234&type=recovery`);
  await second.page.waitForURL(`${APP}/auth/reset-password`);
  await second.page.goto(`${APP}/account`);
  await second.page.waitForURL(`${APP}/auth/reset-password`); // recovery survives reload and blocks the shell
  await second.page.getByLabel('Новый пароль').fill('short');
  await second.page.getByLabel('Повторите пароль').fill('short');
  await second.page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await second.page.getByText('Пароль должен содержать не менее 8 символов, буквы и цифры.').waitFor();
  await second.page.getByLabel('Новый пароль').fill('newpass2026');
  await second.page.getByLabel('Повторите пароль').fill('newpass2026');
  await second.page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await second.page.waitForURL(`${APP}/account`);
  assert(second.mock.state.calls.some((call) => call.path === '/auth/v1/user' && call.method === 'PUT' && call.body.password === 'newpass2026'));
  assert(!mock.state.calls.some((call) => call.external), 'no unexpected external requests');
  await second.context.close();
});

await step('reset-password without a recovery session shows an explanation', async () => {
  const { context, page } = await newContext({ signedIn: true });
  await page.goto(`${APP}/auth/reset-password`);
  await page.getByRole('heading', { name: 'Ссылка недействительна' }).waitFor();
  await context.close();
});

await step('delete account: 3-minute cancellable timer, cancel on hidden tab, then Edge Function', async () => {
  const { context, page, mock } = await newContext({ signedIn: true });
  await page.clock.install();
  await page.goto(`${APP}/account/delete`);
  await page.getByRole('button', { name: 'Удалить аккаунт' }).last().click();
  await page.getByRole('dialog', { name: 'Удалить аккаунт?' }).getByRole('button', { name: 'Запустить таймер' }).click();
  await page.getByRole('timer').waitFor();
  await page.getByRole('button', { name: 'Отменить удаление' }).click();
  await page.getByText('Удаление отменено. Аккаунт сохранён.').waitFor();
  await page.clock.fastForward('04:00');
  assert(!mock.state.calls.some((call) => call.path === '/functions/v1/delete-my-account'), 'cancel prevents deletion');

  // Hiding the tab cancels the timer (mobile cancels when the app is backgrounded).
  await page.getByRole('button', { name: 'Удалить аккаунт' }).last().click();
  await page.getByRole('dialog', { name: 'Удалить аккаунт?' }).getByRole('button', { name: 'Запустить таймер' }).click();
  await page.getByRole('timer').waitFor();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  await page.getByText(/Удаление отменено, потому что вкладка была скрыта/).waitFor();
  await page.clock.fastForward('04:00');
  assert(!mock.state.calls.some((call) => call.path === '/functions/v1/delete-my-account'), 'hidden tab prevents deletion');

  await page.getByRole('button', { name: 'Удалить аккаунт' }).last().click();
  await page.getByRole('dialog', { name: 'Удалить аккаунт?' }).getByRole('button', { name: 'Запустить таймер' }).click();
  await page.clock.fastForward('02:00');
  assert(!mock.state.calls.some((call) => call.path === '/functions/v1/delete-my-account'), 'not before three minutes');
  await page.clock.fastForward('01:05');
  await page.waitForURL(`${APP}/account-deleted`);
  const call = mock.state.calls.find((item) => item.path === '/functions/v1/delete-my-account');
  assert.equal(call.body.confirmation, 'delete-my-account');
  await page.getByRole('heading', { name: 'Аккаунт удалён' }).waitFor();
  assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY), null);
  await context.close();
});

await step('unknown route shows 404 page; app never requests third-party hosts', async () => {
  const { context, page, mock } = await newContext({ signedIn: true });
  await page.goto(`${APP}/definitely-missing`);
  await page.getByRole('heading', { name: 'Здесь пока тихо.' }).waitFor();
  await page.goto(`${APP}/account`);
  await page.waitForLoadState('networkidle');
  assert.deepEqual(mock.state.calls.filter((call) => call.external), []);
  await context.close();
});

await browser.close();
await new Promise((done) => server.close(done));
console.log(`\n${results.length - failures}/${results.length} E2E checks passed.`);
if (failures) process.exit(1);
