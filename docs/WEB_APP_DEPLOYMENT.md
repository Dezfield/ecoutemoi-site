# Web app (app.ecoutemoi.ru): build, configuration and deployment

Status: approved by the owner for the 2026-09-24 production release as a web account centre for **existing** users (web signup stays off). Host: **Cloudflare Pages** project `ecoutemoi-app`. The release receipt is `WEB_RELEASE_2026-09-24.md`. Nothing in this repository creates DNS records, changes Supabase settings or publishes the app.

## 1. Architecture

| Part | Folder | Build | Domain | Deployment |
|---|---|---|---|---|
| Public site | `/` (`src/`, `public/`, `scripts/`) | `npm run build` / `build:production` | `ecoutemoi.ru` | Existing GitHub Pages workflow (`.github/workflows/pages.yml`) — unchanged |
| Web app / личный кабинет | `app/` | `cd app && npm run build` | `app.ecoutemoi.ru` | Cloudflare Pages project `ecoutemoi-app` (root `app`, output `dist`) |
| Backend | `ecoutemoi-mobile/supabase` | — | Supabase project (existing) | Unchanged |

- One repository, two independent Vite builds with their own `package.json`, lockfile, lint and TypeScript configs. The app shares only the design tokens (`app/src/styles/app.css` imports `src/tokens.css`).
- The app is a client-side SPA (React 19, React Router 7, `@supabase/supabase-js` 2). It is configured with the Supabase project of the mobile app and uses only the publishable key. There is no web-specific user table, auth database, JWT or password storage: a person signs in to the same `auth.users` identity and sees the same `profiles` / `dating_profiles` rows.
- **Backend contracts:** the web uses only backend objects committed in `ecoutemoi-mobile` `main`. The complete list with source files and line numbers, and the list of objects that are *not* present in `main`, is in [`WEB_BACKEND_MATRIX.md`](WEB_BACKEND_MATRIX.md). It is enforced by `app/tests/unit/backend-contracts.test.mjs` and by the E2E mock. No migration, policy or function was added or changed for the web app.
- Since ecoutemoi-mobile PR #5 the web also lists active sessions, exports the user's own data, edits notification preferences, shows the safety centre with appeals, and deletes the account through the protected `delete-my-account` Edge Function (three-minute cancellable timer; success only after `{deleted: true}`). VK, Apple and Google sign-in, signup, payments and product areas (Голоса, Резонансы, chat) are not part of this release.
- The public site only links to the app (`Личный кабинет` in the header). It contains no Supabase client, no auth and no user data.

GitHub Pages serves one custom domain per repository and already serves `ecoutemoi.ru`, so `app.ecoutemoi.ru` is served by Cloudflare Pages (DNS is already in Cloudflare). Do not move `ecoutemoi.ru` away from GitHub Pages as part of the app launch.

## 2. Build

Requirements: Node.js ≥ 22.12 (CI uses 24), npm.

```sh
cd app
npm ci
cp .env.example .env.local   # fill in public values only
npm run check                # lint + unit tests + typecheck + production build + bundle check
npm run test:e2e             # browser E2E against a mocked Supabase (verified contracts only)
npm run preview              # serves app/dist on http://127.0.0.1:4174 with SPA fallback
```

- Output directory: `app/dist` (static files only; no source maps).
- Root directory for a hosting provider: `app`.
- Build command: `npm ci && npm run build`.
- Local development: `npm run dev` → http://127.0.0.1:5174.
- E2E needs Chromium: Playwright's bundled browser (`npx playwright install chromium`), `E2E_BROWSER_CHANNEL=msedge|chrome`, or `E2E_CHROMIUM_PATH=<binary>`.

`.github/workflows/app.yml` verifies the app (lint, unit tests, typecheck, build, E2E) on pushes and pull requests that touch `app/`. It does not deploy.

## 3. Environment variables (all public, embedded in the bundle)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://<ref>.supabase.co` | Same value as mobile `EXPO_PUBLIC_SUPABASE_URL` (`ecoutemoi-mobile/.env.example`) |
| `VITE_SUPABASE_ANON_KEY` | yes | `sb_publishable_…` | Same value as mobile `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Never** a `service_role` key |
| `VITE_PUBLIC_SITE_URL` | no | `https://ecoutemoi.ru` | Legal/support/FAQ links. Default `https://ecoutemoi.ru` |
| `VITE_TERMS_URL`, `VITE_PRIVACY_URL` | no | | Overrides; default `${site}/terms/`, `${site}/privacy/` |
| `VITE_AUTH_SIGNUP_ENABLED` | no | `false` | Web registration. Only the literal `true` enables it; default **off**. Must stay off for public production (§6) |
| `VITE_AUTH_OAUTH_PROVIDERS` | no | `google` or `apple,google` | Only listed providers get a button, and **only when `VITE_AUTH_SIGNUP_ENABLED=true`**: a first OAuth sign-in creates a new Supabase user, so OAuth is also a registration path. Leave empty until the provider's web flow is configured (§5) |

Without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` the app builds and shows "Вход временно недоступен" instead of crashing.

With signup disabled, `/signup` shows «Регистрация на сайте пока недоступна. Создайте аккаунт в приложении Écoute Moi.», the sign-in screen never asks Supabase to create a user (`shouldCreateUser: false`), and sign-in of existing accounts by email code works unchanged.

The auth callback URL is derived from the current origin: `https://<origin>/auth/callback`. There is no app-URL variable to keep in sync.

## 4. Hosting requirements

1. **HTTPS only**, with automatic certificate for `app.ecoutemoi.ru`.
2. **SPA fallback**: every path that is not a file (`/login`, `/account/security`, `/auth/callback?...`) must return `index.html` with status 200. Examples:
   - Cloudflare Pages / Netlify: `_redirects` → `/*  /index.html  200` (Cloudflare Pages also falls back automatically when no `404.html` exists).
   - nginx: `location / { try_files $uri /index.html; }`.
3. **Caching**: `assets/*` are content-hashed → `Cache-Control: public, max-age=31536000, immutable`; `index.html` → `no-cache`.
4. **Security headers**: `app/public/_headers` (copied into `dist`) sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and HSTS for this host only; `app/scripts/check-bundle.mjs` fails the build if they or the SPA fallback (no top-level `404.html`) are missing. A Content-Security-Policy is **not** enforced yet; a candidate to test first in report-only mode (adjust `<ref>`):
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://<ref>.supabase.co; media-src 'self' https://<ref>.supabase.co; connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
   X-Frame-Options: DENY
   X-Content-Type-Options: nosniff
   Referrer-Policy: strict-origin-when-cross-origin
   Strict-Transport-Security: max-age=31536000
   ```
   Verify the CSP in a staging deployment before enforcing it (start with `Content-Security-Policy-Report-Only`).
5. `robots.txt` (`Disallow: /`) and `<meta name="robots" content="noindex,nofollow">` are part of the build: the app must not be indexed.

Cloudflare Pages settings: framework preset none, root directory `app`, build command `npm ci && npm run build`, output `dist`, `NODE_VERSION=24` (≥ 22.12). Production env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key only), `VITE_PUBLIC_SITE_URL=https://ecoutemoi.ru`, `VITE_AUTH_SIGNUP_ENABLED=false`, `VITE_AUTH_OAUTH_PROVIDERS` empty.

## 5. Manual configuration

### DNS (Cloudflare) — only after the host is chosen
- Add **one** record for `app` as instructed by the host (usually `CNAME app → <host target>`).
- Do not change apex, `www`, `admin`, verification, mail or CAA records (see `DNS_SETUP.md`).

### Supabase → Authentication → URL Configuration
- Keep every existing redirect URL unchanged.
- Add exactly: `https://app.ecoutemoi.ru/auth/callback`.
- For local development only (optional, remove if not needed): `http://127.0.0.1:5174/auth/callback`.
- Do not add wildcard origins.

### Email templates
- The web signs in with the email one-time code (`signInWithOtp` + `verifyOtp`). Mobile `main` verifies a 6–8 digit code from the email as well (`src/services/cloudChat.ts`, `verifyCloudEmailOtp()`), so the Magic Link / OTP template must contain `{{ .Token }}`.
- Password recovery: mobile `main` has no password sign-in and the web has none either; the web only completes a recovery link safely (the session must set a new password first) and does not link to the recovery page from the sign-in screen. If recovery links should ever open the web, the recovery template must follow the requested redirect, e.g. `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`; test every client before changing a production template.

### Identity linking (all providers)
Supabase Auth by default links identities that share a verified email address to one user (Supabase documentation, "Identity Linking" → automatic linking). Whether two sign-in methods lead to the same Écoute Moi account therefore depends on the project's Auth configuration and on the emails of the identities; the web makes no promise about it. The web UI says only that sign-in methods belong to one account if they are already linked to it, and never tells a person that an email code will open the account they use with another method.

### Google / Apple (web)
Mobile `main` has no Apple or Google sign-in. Enabling either on the web is an external configuration step (Supabase dashboard; for Apple a Services ID, domain, return URL `https://<ref>.supabase.co/auth/v1/callback` and a rotating client secret), which cannot be verified from the repositories. Because the first OAuth sign-in creates a Supabase user, OAuth buttons appear only when `VITE_AUTH_SIGNUP_ENABLED=true` and the provider is listed in `VITE_AUTH_OAUTH_PROVIDERS`. Test with the real project before enabling.

### VK (web) — not implemented
VK web sign-in is not implemented. `ecoutemoi-mobile` `main` stores linked VK accounts in `private.external_auth_identities` and reports them through `get_my_login_methods()`, so the web shows whether VK is connected (with its display name). Signing in with VK on the web needs a separately verified redirect/callback flow (the `vk-id-auth` Edge Function is not deployed in production as of 2026-09-24); it is not part of this release.

## 6. Release blockers and checklist

**WEB SIGNUP MUST NOT BE ENABLED FOR PUBLIC PRODUCTION UNTIL:**
- the Terms and the Privacy Policy are final: `/terms/` and `/privacy/` now publish **preliminary** texts (`docs/LEGAL_AUDIT_2026-09-23.md`) that the web must not present as final;
- the 18+ consent flow and its legal wording are product-approved;
- transactional email works for every address (email one-time codes are the only web sign-in);
- signup behaviour is tested against the real Supabase project.

Production therefore builds with `VITE_AUTH_SIGNUP_ENABLED=false` and an empty `VITE_AUTH_OAUTH_PROVIDERS`. Google is also disabled in the production Auth settings; Apple and VK web flows are not verified.

**Checklist:**
1. Choose and approve the host; create the project with root `app`, build `npm ci && npm run build`, output `dist`, env vars from §3.
2. Re-check `WEB_BACKEND_MATRIX.md` against the current `ecoutemoi-mobile` `main` (last: `3098d8c`, 2026-09-26).
3. Deploy to the host's preview URL; add that preview callback URL to Supabase temporarily if you want to test auth there.
4. Configure `app.ecoutemoi.ru` + DNS record + HTTPS; add the production callback URL in Supabase.
5. Verify: `/login` → email code sign-in with a real test account; refresh keeps the session; `/account/*` sections load; logout; deep link refresh (`/account/security`); `/auth/callback?error=access_denied` shows "Вход отменён"; unknown path shows 404 page; response headers; `robots.txt`.
6. Only after the app answers on `https://app.ecoutemoi.ru`, deploy the public site change that adds the `Личный кабинет` link (otherwise visitors get a dead link).

## 7. Rollback
- App: redeploy the previous build on the host or disable the project; the site link then fails, so also redeploy the previous site artifact if the app is withdrawn for long.
- Supabase: remove only the web callback URL(s) added above.
- DNS: remove only the `app` record.
