# Web app backend capability matrix

This matrix is the source of truth for which backend objects the web app (`app/`, app.ecoutemoi.ru) may use. Re-check it before every deployment and whenever `app/src/account/api.ts` or `app/src/auth/` changes.

**Backend source of truth:** `Dezfield/ecoutemoi-mobile`, branch `main`, commit `9cb650085e95baca16786588165abf2a44ad1f77` (2026-09-24, merge of PR #8; includes PR #5 "account deletion lifecycle + stale-JWT guards"). Line numbers below refer to that commit.

**Production check (2026-09-24, read-only):** project `btxqktrxlsvamwimxuhu`. Every RPC listed as VERIFIED exists, is executable by `authenticated` and not by `anon`; the seven account RPCs marked *guarded* start with `perform private.require_existing_account();` (identical to main, verified after the PR #5 rollout). `delete-my-account` is deployed as version 2 with `verify_jwt` on; its live source is byte-identical to main. The CHECK constraints of `user_sanctions`, `moderation_appeals` and `user_reports` match main.

Enforcement: `app/tests/unit/backend-contracts.test.mjs` fails if the web source calls an RPC, table, storage bucket or Edge Function that is not listed as VERIFIED, sends a user id to an own-account call, or references a service-role key. `app/scripts/e2e.mjs` mocks only the VERIFIED contracts (with the shapes below) and fails on any other backend request.

## Status legend

| Status | Meaning |
|---|---|
| VERIFIED | Committed in mobile `main` (file and line given) and present in production; the web uses it. |
| PLATFORM | Standard Supabase Auth behaviour of `@supabase/supabase-js`, not a custom backend object. |
| AVAILABLE, NOT USED | Committed in `main`, deliberately not used by the web (reason given). |

## Verified and platform contracts used by the web

| Feature | Frontend | Backend object and shape | Evidence (ecoutemoi-mobile `main`) | Status |
|---|---|---|---|---|
| Dating profile (read-only) | `loadDatingProfile()` | RPC `get_my_dating_profile_v5()` | `supabase/migrations/20260813_country_city_selection.sql:38`, grant `:76` | VERIFIED |
| Profile photos / audio letter | `loadProfileMedia()`, `loadAccountSummary()` | Private buckets `dating-photos`, `dating-audio`; 15-minute signed URLs of own paths | Read policies `dating_audio_select_allowed` `20260810_voice_dating_mvp.sql:325`, `dating_photos_storage_select_allowed` `:381` | VERIFIED |
| Display name, creation date | `loadAccountSummary()` | Table `profiles`, own row | Policy `profiles_select_allowed_people` `20260810_safety_foundation.sql:289` | VERIFIED |
| Onboarding state | `AuthProvider` | Table `dating_profiles.onboarding_complete`, own row | Policy `dating_profiles_select_self` `20260810_voice_dating_mvp.sql:307` | VERIFIED |
| «Рядом» status (read-only) | `loadNearbyOptIn()` | Table `privacy_settings.nearby_opt_in`, own row | Policy `privacy_settings_select_self` `20260810_safety_foundation.sql:310` (`user_id = auth.uid()`) | VERIFIED |
| Premium status | `loadEntitlement()` | RPC `get_my_entitlement()` → `(tier, is_premium, premium_until)`; shown as Free / Premium / Founder | `20260820_chat_product_premium.sql:498`, grant `:686` | VERIFIED |
| Blocked users | `loadBlockedUsers()` | RPC `get_my_blocked_users()` → `(user_id, display_name, blocked_at)` | `20260810_safety_foundation.sql:451`, grant `:869` | VERIFIED |
| Unblock | `unblockUser()` | RPC `unblock_user(p_blocked_user_id)`; actor is `auth.uid()` | `20260810_safety_foundation.sql:431`, grant `:868` | VERIFIED |
| Sign-in methods | `loadLoginMethods()` | RPC `get_my_login_methods()` → jsonb array `{provider: apple\|google\|vk\|email, connected, identityId, label}` | `20260921120100_account_rpc_deletion_guards.sql:23` (guarded), grant `20260902_auth_identities.sql:281` | VERIFIED |
| Active sessions | `loadActiveSessions()` | RPC `get_my_active_sessions()` → `(session_id, created_at, updated_at, user_agent, ip_address, current_session)` of `auth.uid()` only | `20260921120100_account_rpc_deletion_guards.sql:104` (guarded), grant `20260905_account_portability_sessions.sql:147` | VERIFIED |
| Data export | `exportAccountData()` | RPC `export_my_account_data()` → jsonb (account, profile, dating profile, photos, privacy, sent messages, blocks, reports, sanctions, appeals, feedback, premium preferences); no argument | `20260921120100_account_rpc_deletion_guards.sql:136` (guarded), grant `20260905_account_portability_sessions.sql:150` | VERIFIED |
| Notification settings | `loadNotificationPreferences()`, `saveNotificationPreferences()` | RPC `get_my_notification_preferences_v1()` → jsonb `{messagesEnabled, datingEnabled, productEnabled, quietHoursEnabled, quietStart, quietEnd, timezone, deliveryMode, safetyAlwaysOn, updatedAt}`; RPC `update_my_notification_preferences_v1(p_messages_enabled, p_dating_enabled, p_product_enabled, p_quiet_hours_enabled, p_quiet_start, p_quiet_end, p_timezone, p_delivery_mode)` | `20260921120100_account_rpc_deletion_guards.sql:414`, `:445` (guarded), grants `20260906_managed_notifications.sql:467-468` | VERIFIED |
| Safety centre | `loadSafetyCenter()` | RPC `get_my_safety_center_v1()` → jsonb `{accountStatus, activeSanction{id, kind, reason, startsAt, expiresAt, appeal}, recentReports[], recentAppeals[], hasMoreReports}` | `20260921120100_account_rpc_deletion_guards.sql:253` (guarded), grant `20260905_zzz_user_safety_center.sql:172` | VERIFIED |
| Appeal | `submitAppeal()` | RPC `submit_moderation_appeal(p_sanction_id, p_reason)`; the id is `activeSanction.id` from the safety centre, never typed by the user; 20–1500 characters | `20260921120100_account_rpc_deletion_guards.sql:351` (guarded), grant `20260905_zzz_user_safety_center.sql:175` | VERIFIED |
| Account deletion | `deleteAccount()` | Edge Function `delete-my-account`, `POST {confirmation: 'delete-my-account'}` with the user's JWT; target account from `auth.getUser()`; `200 {deleted: true}` only after storage, database and Auth cleanup | `supabase/functions/delete-my-account/index.ts:51-52`, `:68`; lifecycle `20260921120000_account_deletion_lifecycle.sql` | VERIFIED |
| Email sign-in | `sendEmailCode()`, `verifyEmailCode()` | Supabase Auth `signInWithOtp` (`shouldCreateUser: false` unless web signup is enabled) + `verifyOtp` | — | PLATFORM |
| Session restore / refresh | `AuthProvider` | supabase-js session storage and refresh | — | PLATFORM |
| Sign-out (this browser) | `signOut()` | `auth.signOut({ scope: 'local' })` | — | PLATFORM |
| End other sessions | `signOutOtherSessions()` | `auth.signOut({ scope: 'others' })` | — | PLATFORM |
| OAuth / email-link callback | `/auth/callback` | PKCE `exchangeCodeForSession`, `verifyOtp({ token_hash })` | — | PLATFORM |
| Password recovery link | `/auth/reset-password` | `updateUser({ password })` after a recovery link; not linked from the sign-in screen | — | PLATFORM |

## Committed in `main` but deliberately not used

| Backend object | Evidence | Why the web does not use it |
|---|---|---|
| `get_my_account_restriction()` | `20260810_trust_safety_push.sql:92` | Replaced by `get_my_safety_center_v1()`, which also returns the sanction id needed for an appeal, warnings, reports and appeals. |
| `unlink_my_vk_identity()` | `20260921120100_account_rpc_deletion_guards.sql:73` | Sign-in methods are managed in the app; VK is not available on the web. |
| `get_my_notification_center_v1(p_limit)`, `mark_my_notification_center_read_v1()` | `20260921120100_account_rpc_deletion_guards.sql:527`, `:570` | The notification centre was not part of the web account scope. |
| `get_my_store_subscription_v1` and other store/billing RPCs | — | Not needed for the web status: `get_my_entitlement()` is the canonical Free / Premium / Founder source. No payment source is shown. |
| `set_my_nearby_opt_in(boolean)`, `update_my_privacy_settings(...)` | `20260820_chat_product_premium.sql:10`, `20260810_safety_foundation.sql:338` | Privacy is shown read-only; changes stay in the app. |
| `begin_delete_my_dating_profile()`, `delete_my_dating_profile()` | `20260810_delete_dating_profile.sql:7`, `:56` | They reset the dating profile («Удалить карточку»); account deletion uses `delete-my-account`. |
| VK sign-in (`vk-id-auth` infrastructure) | — | Needs a separately verified web redirect/callback flow; not in this release. |

## Behaviour after account deletion

The seven guarded RPCs above answer `42501 Account is unavailable` for a deleted or missing profile, also for an unexpired JWT issued before the deletion (verified live after the PR #5 rollout). After a successful `delete-my-account` response the web navigates to the public `/account-deleted` page, clears the local session and requests no account data.
