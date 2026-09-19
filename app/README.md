# Écoute Moi — web app (личный кабинет)

Separate Vite application for `app.ecoutemoi.ru`, living next to the public site in the same repository. It is configured with the **Supabase project of the mobile app**, so a person signs in to the same auth user and sees the same profile rows. On the web, sign-in is by email one-time code.

Current scope (web account foundation): email-code sign-in, optional email-code registration behind `VITE_AUTH_SIGNUP_ENABLED` (off by default — see the release blockers in [`../docs/WEB_APP_DEPLOYMENT.md`](../docs/WEB_APP_DEPLOYMENT.md)), auth callback, protected account area with overview, profile (read-only), sign-in methods (read-only), privacy («рядом» status, read-only), Premium status, account restriction status, ending other sessions, blocked users with unblock, support, documents and sign-out.

Sections without a backend in `ecoutemoi-mobile` `main` show an honest "not available on the web" state and make no backend calls: data export, notification preferences, session list, appeals and account deletion. Voices, Отклики, Резонансы and chats stay in the mobile app; the router and navigation are prepared for them.

Every backend object the app uses — and every one it must not use — is listed with its source in [`../docs/WEB_BACKEND_MATRIX.md`](../docs/WEB_BACKEND_MATRIX.md).

```sh
npm ci
cp .env.example .env.local     # public values only
npm run dev                    # http://127.0.0.1:5174
npm run check                  # lint + unit tests + typecheck + build + bundle check
npm run test:e2e               # Playwright E2E against a mocked Supabase (verified contracts only)
```

Structure:
- `src/auth/` — AuthProvider (session state), route guards, email-code/OAuth/recovery services, callback parsing, error texts.
- `src/account/` — data access through RLS tables and RPCs committed in `ecoutemoi-mobile` `main`; display labels matching the mobile option labels.
- `src/layouts/`, `src/pages/`, `src/components/` — UI; `src/styles/app.css` reuses the site tokens from `../src/tokens.css`.
- `tests/unit/` — Node test runner, including `backend-contracts.test.mjs` (allowlist of verified backend objects); `scripts/e2e.mjs` — browser checks; `scripts/serve.mjs` — local SPA preview.

Deployment, environment variables and required Supabase/OAuth settings: [`../docs/WEB_APP_DEPLOYMENT.md`](../docs/WEB_APP_DEPLOYMENT.md).
