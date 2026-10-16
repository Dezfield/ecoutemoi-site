# Web 2.0 release and provider configuration

This branch is a review candidate. Do not merge or deploy it without the owner's final approval after review. The public site and app have separate builds and hosts; keep their existing domains and infrastructure.

## Reproduce locally

Node 24.16.0 / npm 11.13.0 were used. From the checkout:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run check
cd app
npm.cmd ci --no-audit --no-fund
npm.cmd run check
$env:E2E_BROWSER_CHANNEL = 'chrome'
npm.cmd run test:e2e
```

E2E exercises synthetic accounts and backend contracts, including all six requested viewport widths and axe checks. It makes no real account, sends no OTP, and does not prove real OAuth, Safari or cross-device acceptance. Original obsolete voice/reveal tests and implementations are retained under docs/archive/web-before-2; applicable account regression tests remain active.

## Provider setup (server values only; never add secrets to VITE variables)

1. Review and merge the separate backend PR, including the exact VK return URI migration. Apply the reviewed migration through the existing reconciliation process; do not run a generic db push. Deploy the reviewed oauth-broker and vk-id-auth code before enabling frontend providers.
2. Google: retain the existing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL contract used by iPhone. Verify the exact registered server callback `https://api.ecoutemoi.ru/functions/v1/oauth-broker/google/callback`. Verify that the existing identity resolves to the same auth user before enabling web readiness.
3. Apple: create/verify a web Services ID grouped with the existing primary App ID so provider subjects remain compatible. Configure the domain and exact return `https://api.ecoutemoi.ru/functions/v1/oauth-broker/apple/web-callback`. Set APPLE_WEB_CLIENT_ID, APPLE_WEB_CLIENT_SECRET and APPLE_WEB_CALLBACK_URL on the server. Record secret expiry/rotation privately. Do not replace the native audience or Apple deletion credentials.
4. VK ID: verify the existing server VK_ID_CALLBACK_URL and its registered redirect and PKCE flow. The new app return is exactly `https://app.ecoutemoi.ru/auth/broker/callback`; no wildcard, arbitrary host, path prefix or query-suffixed return is accepted.
5. Use owner-authorized existing test accounts to verify sign-in/repeat sign-in, same user IDs as iPhone, linking A, foreign-account linking rejection, ticket replay, cancellation, logout and session restoration for EACH provider. Do not use real-user accounts as test fixtures.
6. Only after successful real QA, set AUTH_APPLE_WEB_READY / AUTH_GOOGLE_WEB_READY / AUTH_VK_WEB_READY per provider, and enable that provider in the frontend VITE_AUTH_OAUTH_PROVIDERS allowlist. The frontend also requires the server web capability; native capability is insufficient. Web registration stays off until its consent/onboarding release gate is approved. The current allowlist remains additionally gated by VITE_AUTH_SIGNUP_ENABLED because broker sign-in may create a new account.

## Product rollout and outstanding acceptance

- Keep the existing audio_letters_v1 rollout unchanged (live: canary, global percentage 0). Test authorized cohort accounts before a separately approved rollout. The caller's actual server eligibility controls the UI.
- Verify iPhone ↔ browser text/photos, view-once consumption on both devices, expiry, canonical emoji/sticker keys, reactions, read markers, blocked/foreign conversations and deleted-account JWT denial against the real backend.
- Browser Safari on an iPhone, real microphone permissions and real provider consent screens require device QA. Chromium mocks do not establish those results.
- Apple-linked deletion currently fails closed with a clear instruction to confirm in the iPhone app. Completing the Apple revocation proof in the browser remains an explicit programming/review gate, not an external-setting-only claim.
- No chat audio/video recorder, video circles or calling is introduced. Existing unsupported media types remain visible as informative history entries. Audio recording belongs only to letters and pre-disclosure voice threads.
- Legal documents from 14 October are preserved. Review any new registration consent wording before enabling signup. The public landing describes the new flow and the current free stage while keeping pre-release availability wording consistent with rollout.

## Independent review

The implementation author cannot count self-review as independent review. The PRs and this evidence package are prepared for a separate reviewer. Production publication and global feature/provider activation remain unperformed.
