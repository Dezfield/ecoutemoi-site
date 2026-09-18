# Écoute Moi — web app (личный кабинет)

Separate Vite application for `app.ecoutemoi.ru`, living next to the public site in the same repository. It uses the **same Supabase project and the same user identity** as the iOS/Android app: sign in with the same email (one-time code) or, once enabled for the web, the same Apple/Google account.

Current scope (web account foundation): sign-in / sign-up by email code, legacy password recovery, OAuth callback, protected account area with overview, profile (read-only), account & sign-in methods, data export, privacy, notification preferences, subscription status, account status & appeals, active sessions, blocked users, support, documents, sign-out and account deletion. Voices, Отклики, Резонансы and chats stay in the mobile app for now; the router and navigation are prepared for them.

```sh
npm ci
cp .env.example .env.local     # public values only
npm run dev                    # http://127.0.0.1:5174
npm run check                  # lint + unit tests + typecheck + build
npm run test:e2e               # Playwright E2E against a mocked Supabase
```

Structure:
- `src/auth/` — AuthProvider (session state), route guards, email-code/OAuth/recovery services, callback parsing, error texts (ported from mobile).
- `src/account/` — data access through existing RLS tables, RPCs and the `delete-my-account` Edge Function; labels ported from mobile.
- `src/layouts/`, `src/pages/`, `src/components/` — UI; `src/styles/app.css` reuses the site tokens from `../src/tokens.css`.
- `tests/unit/` — Node test runner; `scripts/e2e.mjs` — browser checks; `scripts/serve.mjs` — local SPA preview.

Deployment, environment variables and required Supabase/OAuth settings: [`../docs/WEB_APP_DEPLOYMENT.md`](../docs/WEB_APP_DEPLOYMENT.md).
