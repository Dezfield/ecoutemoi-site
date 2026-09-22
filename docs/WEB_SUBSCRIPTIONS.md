# Subscriptions on ecoutemoi.ru — web side

The full architecture, the YooKassa contract, the webhook security model, the
required environment variables and the Apple analysis live in the backend
repository: `Dezfield/ecoutemoi-mobile`, `docs/WEB_SUBSCRIPTIONS.md` and
`docs/BILLING_ARCHITECTURE.md`. This file covers only what this repository
contains.

## What the web app does

| File | Role |
|---|---|
| `app/src/account/billing.ts` | every billing call: status, offers, checkout, cancel |
| `app/src/pages/account/SubscriptionPage.tsx` | `/account/subscription` — status, tariffs, purchase, cancel autopayment |
| `app/src/pages/account/PaymentResultPage.tsx` | `/account/subscription/payment` — the provider's return URL |
| `app/src/account/types.ts` | `BillingStatus`, `BillingOffer`, `CheckoutStart` |

## Rules this code must keep

1. **The browser never decides a price.** A purchase sends `offer_id`,
   `save_payment_method` and a same-origin `return_url` — nothing else. Prices
   come from `list_billing_offers_v1()`. Enforced by
   `app/tests/unit/backend-contracts.test.mjs`.
2. **The browser never sends a user id.** The `billing-create-checkout` Edge
   Function takes the account from the access token that supabase-js attaches.
3. **The return URL is not proof of payment.** `PaymentResultPage` asks
   `get_my_billing_status_v1()` and shows «Платёж обрабатывается» with a
   bounded number of retries (2s, 3s, 5s, 8s, 12s) before offering a manual
   check. It never says a subscription is active because a redirect happened.
4. **No provider secret in the bundle.** Only the Supabase URL and the
   publishable key are build-time configuration. `app/scripts/check-bundle.mjs`
   and the contract test fail otherwise.
5. **One status for every platform.** The page shows the effective level of the
   account — a subscription bought in the app and one bought here look the
   same. The payment provider is used only to pick the management action
   (Apple's own flow, or this backend), never shown as a label.

## Deployment blocker

The backend objects are in `Dezfield/ecoutemoi-mobile` branch
`claude/web-subscriptions-billing`, **not merged into `main` yet**. Until that
branch is merged and the migration and Edge Functions are applied to the
Supabase project:

- `get_my_billing_status_v1()` is missing, so the page falls back to
  `get_my_entitlement()` and shows the correct level with no management action;
- `list_billing_offers_v1()` is missing, so no tariffs are shown and the page
  says payment on the site is not open yet;
- nothing errors and nothing is claimed that is not true.

See `docs/WEB_BACKEND_MATRIX.md` § Billing for the per-contract status.

## Tests

- `app/tests/unit/backend-contracts.test.mjs` — RPC, table, bucket and Edge
  Function allowlist; no price, currency or user id sent from the browser; no
  `service_role` key or provider secret in the sources.
- `app/scripts/e2e.mjs` — five billing checks against a mocked Supabase that
  refuses any contract outside the allowlist: status and tariffs, founder /
  free / expired / Exclusive, checkout body, the return page proving nothing,
  and cancelling autopayment keeping the paid period.
