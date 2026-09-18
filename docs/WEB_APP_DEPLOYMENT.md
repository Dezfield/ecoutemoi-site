# Web app (app.ecoutemoi.ru): build, configuration and deployment

Status: **deploy-ready code, not deployed.** Hosting for `app.ecoutemoi.ru` has not been chosen or approved. Nothing in this repository creates DNS records, changes Supabase settings or publishes the app.

## 1. Architecture

| Part | Folder | Build | Domain | Deployment |
|---|---|---|---|---|
| Public site | `/` (`src/`, `public/`, `scripts/`) | `npm run build` / `build:production` | `ecoutemoi.ru` | Existing GitHub Pages workflow (`.github/workflows/pages.yml`) — unchanged |
| Web app / личный кабинет | `app/` | `cd app && npm run build` | `app.ecoutemoi.ru` | **Separate static host — owner decision required** |
| Backend | `ecoutemoi-mobile/supabase` | — | Supabase project (existing) | Unchanged |

- One repository, two independent Vite builds with their own `package.json`, lockfile, lint and TypeScript configs. The app shares only the design tokens (`app/src/styles/app.css` imports `src/tokens.css`).
- The app is a client-side SPA (React 19, React Router 7, `@supabase/supabase-js` 2). It talks directly to the **same Supabase project as the mobile app** with the publishable key. There is no web-specific user table, auth database, JWT or password storage: a person signs in to the same `auth.users` identity and sees the same `profiles` / `dating_profiles` rows.
- Every read/write goes through existing RLS policies and SECURITY DEFINER RPCs; account deletion goes through the existing `delete-my-account` Edge Function. No migration, policy or function was added or changed for the web app.
- The public site only links to the app (`Личный кабинет` in the header). It contains no Supabase client, no auth and no user data.

GitHub Pages serves one custom domain per repository. The site already uses it for `ecoutemoi.ru`, so `app.ecoutemoi.ru` needs a different static host (or a separate Pages repository). Do not move `ecoutemoi.ru` to another provider as part of the app launch.

## 2. Build

Requirements: Node.js ≥ 22.12 (CI uses 24), npm.

```sh
cd app
npm ci
cp .env.example .env.local   # fill in public values only
npm run check                # lint + unit tests + typecheck + production build
npm run test:e2e             # optional: browser E2E against a mocked Supabase
npm run preview              # serves app/dist on http://127.0.0.1:4174 with SPA fallback
```

- Output directory: `app/dist` (static files only; no source maps).
- Root directory for a hosting provider: `app`.
- Build command: `npm ci && npm run build`.
- Local development: `npm run dev` → http://127.0.0.1:5174.

`.github/workflows/app.yml` verifies the app (lint, unit tests, typecheck, build) on pushes and pull requests that touch `app/`. It does not deploy.

## 3. Environment variables (all public, embedded in the bundle)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://<ref>.supabase.co` | Same value as mobile `EXPO_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | yes | `sb_publishable_…` | Same value as mobile `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Never** a `service_role` key |
| `VITE_PUBLIC_SITE_URL` | no | `https://ecoutemoi.ru` | Legal/support/FAQ links. Default `https://ecoutemoi.ru` |
| `VITE_TERMS_URL`, `VITE_PRIVACY_URL` | no | | Overrides; default `${site}/terms/`, `${site}/privacy/` |
| `VITE_AUTH_OAUTH_PROVIDERS` | no | `google` or `apple,google` | Only listed providers get a button. Leave empty until the provider's web flow is configured (§5) |

Without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` the app builds and shows "Вход временно недоступен" instead of crashing.

The auth callback URL is derived from the current origin: `https://<origin>/auth/callback`. There is no app-URL variable to keep in sync.

## 4. Hosting requirements

1. **HTTPS only**, with automatic certificate for `app.ecoutemoi.ru`.
2. **SPA fallback**: every path that is not a file (`/login`, `/account/security`, `/auth/callback?...`) must return `index.html` with status 200. Examples:
   - Cloudflare Pages / Netlify: `_redirects` → `/*  /index.html  200` (Cloudflare Pages also falls back automatically when no `404.html` exists).
   - nginx: `location / { try_files $uri /index.html; }`.
3. **Caching**: `assets/*` are content-hashed → `Cache-Control: public, max-age=31536000, immutable`; `index.html` → `no-cache`.
4. **Security headers** (recommended; set on the host, adjust `<ref>`):
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://<ref>.supabase.co; media-src 'self' https://<ref>.supabase.co; connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
   X-Frame-Options: DENY
   X-Content-Type-Options: nosniff
   Referrer-Policy: strict-origin-when-cross-origin
   Strict-Transport-Security: max-age=31536000
   ```
   Verify the CSP in a staging deployment before enforcing it (start with `Content-Security-Policy-Report-Only`).
5. `robots.txt` (`Disallow: /`) and `<meta name="robots" content="noindex,nofollow">` are part of the build: the app must not be indexed.

Hosting options for the owner to choose from (not decided here): Cloudflare Pages (DNS is already on Cloudflare), Netlify, Vercel, an existing VPS with nginx, or a second GitHub Pages repository.

## 5. Manual configuration

### DNS (Cloudflare) — only after the host is chosen
- Add **one** record for `app` as instructed by the host (usually `CNAME app → <host target>`).
- Do not change apex, `www`, `admin`, verification, mail or CAA records (see `DNS_SETUP.md`).

### Supabase → Authentication → URL Configuration
- Keep the existing mobile redirect URLs (`ecoutemoi://auth/callback`, `ecoutemoi://auth/confirm-email`, `ecoutemoi://auth/reset-password`).
- Add exactly: `https://app.ecoutemoi.ru/auth/callback`.
- For local development only (optional, remove if not needed): `http://127.0.0.1:5174/auth/callback`.
- Do not add wildcard origins.

### Email templates
- The web app uses the same email one-time code as mobile (`signInWithOtp` + `verifyOtp`); the Magic Link / OTP template must show `{{ .Token }}` (already required by mobile).
- **Password recovery (legacy accounts):** a template hard-coded to `ecoutemoi://auth/reset-password?...` opens the mobile app even when recovery was requested on the web. To support both, the link must follow the requested redirect, e.g. `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` (mobile passes `ecoutemoi://auth/reset-password`, web passes `https://app.ecoutemoi.ru/auth/callback`). Test on iOS before changing the production template. The default `{{ .ConfirmationURL }}` template also works on the web when the link is opened in the same browser.

### Google (web)
The web uses the same Supabase-hosted OAuth flow as the mobile browser flow (Google redirects to `https://<ref>.supabase.co/auth/v1/callback`, then Supabase redirects to `/auth/callback`). After adding the web redirect URL above and testing, set `VITE_AUTH_OAUTH_PROVIDERS=google`. The warning in `ecoutemoi-mobile/AUTH_SETUP.md` about automatic linking of identities with the same email applies to the web equally.

### Apple (web)
Native Sign in with Apple on iOS does not configure the web flow. Before `apple` is enabled on the web: create an Apple **Services ID**, associate it with the App ID, register the domain and the Supabase callback `https://<ref>.supabase.co/auth/v1/callback` as return URL, add the Services ID to Supabase's Apple provider (client IDs) and configure the secret per Supabase docs (the generated secret expires and must be rotated). Then set `VITE_AUTH_OAUTH_PROVIDERS=apple,google`.

### VK (web) — not implemented
`supabase/functions/vk-id-auth` accepts only the mobile return URI `ecoutemoi://auth/vk`. Web support needs a backend change in `ecoutemoi-mobile` (a strict allowlist entry for `https://app.ecoutemoi.ru/auth/vk`, a web route that finalises the ticket, and VK cabinet settings). Until then the login page states that VK sign-in is available in the app.

### Backend functions the app relies on (already used by mobile)
`get_my_dating_profile_v5`, `get_my_store_subscription_v1`, `get_my_login_methods`, `get_my_active_sessions`, `export_my_account_data`, `get_my_blocked_users`, `unblock_user`, `get_my_notification_preferences_v1`, `update_my_notification_preferences_v1`, `get_my_safety_center_v1`, `submit_moderation_appeal`; tables `profiles`, `dating_profiles`, `privacy_settings` (own row); storage buckets `dating-photos`, `dating-audio` (own media, signed URLs); Edge Function `delete-my-account`. Missing server objects produce a neutral "функция ещё не включена" message rather than a broken page.

## 6. Release checklist
1. Choose and approve the host; create the project with root `app`, build `npm ci && npm run build`, output `dist`, env vars from §3.
2. Deploy to the host's preview URL; add that preview callback URL to Supabase temporarily if you want to test auth there.
3. Configure `app.ecoutemoi.ru` + DNS record + HTTPS; add the production callback URL in Supabase.
4. Verify: `/login` → email code sign-in with a real test account; refresh keeps the session; `/account/*` sections load; logout; deep link refresh (`/account/security`); `/auth/callback?error=access_denied` shows "Вход отменён"; unknown path shows 404 page; response headers; `robots.txt`.
5. Only after the app answers on `https://app.ecoutemoi.ru`, deploy the public site change that adds the `Личный кабинет` link (otherwise visitors get a dead link).

## 7. Rollback
- App: redeploy the previous build on the host or disable the project; the site link then fails, so also redeploy the previous site artifact if the app is withdrawn for long.
- Supabase: remove only the web callback URL(s) added above.
- DNS: remove only the `app` record.
