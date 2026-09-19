# Web app backend capability matrix

This matrix is the source of truth for which backend objects the web app (`app/`, app.ecoutemoi.ru) may use. It must be re-checked before every deployment and whenever `app/src/account/api.ts` or `app/src/auth/` changes.

**Backend source of truth:** `Dezfield/ecoutemoi-mobile`, branch `main`, commit `10b42fa967fed5812bf98a90459bfaaf8e67224f` (2026-08-30, "chore: prepare iOS development build"). Checked on 2026-09-19 against committed files only (`supabase/migrations/`, `supabase/functions/`, `supabase/schema.sql`, `src/services/`, `src/lib/`, `App.tsx`). The live Supabase project was not inspected.

Enforcement: `app/tests/unit/backend-contracts.test.mjs` fails if the web source calls an RPC, table, storage bucket or Edge Function that is not listed as VERIFIED below. `app/scripts/e2e.mjs` mocks only the VERIFIED contracts and fails on any other backend request.

## Status legend

| Status | Meaning |
|---|---|
| VERIFIED | Committed in mobile `main` (file and line given); the web uses it. |
| PLATFORM | Standard Supabase Auth behaviour of `@supabase/supabase-js` 2.116.0, not a custom backend object. |
| NOT PRESENT | Not in mobile `main`. The web does not call it and shows an honest fallback. |
| AVAILABLE, NOT USED | Committed in `main`, deliberately not used by the web (reason given). |

## Verified and platform contracts used by the web

| Feature | Frontend | Backend object | Repository evidence (ecoutemoi-mobile `main`) | Status |
|---|---|---|---|---|
| Dating profile (read-only) | `loadDatingProfile()` | RPC `get_my_dating_profile_v5()` | `supabase/migrations/20260813_country_city_selection.sql:38` (grant to `authenticated` :76); called first in `loadMyDatingProfile()`, `src/services/dating.ts:433` | VERIFIED |
| Profile photos / audio letter | `loadProfileMedia()`, `loadAccountSummary()` | Storage buckets `dating-photos`, `dating-audio` (private), 15-minute signed URLs | Buckets `20260810_voice_dating_mvp.sql:128`, `:142`; read policies `dating_audio_select_allowed` :325 and `dating_photos_storage_select_allowed` :381 (owner access in `private.can_access_dating_audio`, `20260828_premium_discovery_v1.sql:521`, and `private.can_access_dating_photos`, `20260825_zz_admin_center_v3.sql:752`); mobile signs the same paths in `src/services/dating.ts:476-481` | VERIFIED |
| Display name, account creation date | `loadAccountSummary()` | Table `profiles` (own row) | Columns `supabase/schema.sql:12-19`; policy `profiles_select_allowed_people` `20260810_safety_foundation.sql:289` (own id allowed by `private.can_view_profile`, :147-148); grant `schema.sql:394` | VERIFIED |
| Onboarding state | `AuthProvider` | Table `dating_profiles`, column `onboarding_complete` (own row) | Policy `dating_profiles_select_self` `20260810_voice_dating_mvp.sql:307`, grant :432; mobile decides on the same flag (`src/services/dating.ts:513`, `src/features/dating/DatingExperience.tsx:5197`) | VERIFIED |
| Premium status | `loadEntitlement()` | RPC `get_my_entitlement()` → `(tier text, is_premium boolean, premium_until timestamptz)` | `supabase/migrations/20260820_chat_product_premium.sql:498` (grant :686); read by mobile `loadCloudSnapshot()`, `src/services/cloudChat.ts:851` | VERIFIED |
| Account status (restriction) | `loadAccountRestriction()` | RPC `get_my_account_restriction()` → `(sanction, reason, expires_at)`; only own active `suspended`/`banned`; no sanction id | `supabase/migrations/20260810_trust_safety_push.sql:92` (grant :285). Not called by mobile `main`. | VERIFIED |
| Blocked users | `loadBlockedUsers()` | RPC `get_my_blocked_users()` → `(user_id, display_name, blocked_at)` | `supabase/migrations/20260810_safety_foundation.sql:451` (grant :869); `src/services/cloudChat.ts:848` | VERIFIED |
| Unblock | `unblockUser()` | RPC `unblock_user(p_blocked_user_id uuid)`; actor is `auth.uid()` | `supabase/migrations/20260810_safety_foundation.sql:431` (grant :868); mobile `unblockCloudUser()`, `src/services/cloudChat.ts:1180` | VERIFIED |
| «Рядом» status (read-only) | `loadNearbyOptIn()` | Table `privacy_settings`, column `nearby_opt_in` (own row) | Table `20260810_safety_foundation.sql:6`, policy `privacy_settings_select_self` :310, grant :331; column `20260820_chat_product_premium.sql:8`; mobile reads the same row, `src/services/cloudChat.ts:842-844` | VERIFIED |
| Email sign-in | `sendEmailCode()`, `verifyEmailCode()` | Supabase Auth `signInWithOtp` (web: `shouldCreateUser: false`) + `verifyOtp` | Same mechanism in mobile `main` `sendCloudEmailOtp()` / `verifyCloudEmailOtp()`, `src/services/cloudChat.ts:733-789` (mobile passes `shouldCreateUser: true`) | PLATFORM |
| Session restore / refresh | `AuthProvider` | supabase-js session storage and refresh | — | PLATFORM |
| Sign-out (this browser) | `signOut()` | `auth.signOut({ scope: 'local' })` | Same scope in mobile `signOutCloudSession()`, `src/services/cloudChat.ts:727` | PLATFORM |
| End other sessions | `signOutOtherSessions()` | `auth.signOut({ scope: 'others' })` → `POST /auth/v1/logout?scope=others` | supabase-js `SIGN_OUT_SCOPES` (`global`, `local`, `others`) | PLATFORM |
| Sign-in methods | `loadLoginMethods()` | `auth.getUser()` → `user.identities` (providers `email`, `phone`, `apple`, `google`) | Mobile `main` signs in with email or phone OTP (`src/services/cloudChat.ts:749`, `:804`); it has no Apple, Google or VK sign-in | PLATFORM |
| OAuth / email-link callback | `/auth/callback` | PKCE `exchangeCodeForSession`, `verifyOtp({ token_hash })` | — | PLATFORM |
| Password recovery link | `/forgot-password`, `/auth/reset-password` | `resetPasswordForEmail`, `updateUser({ password })` | Mobile `main` has never had password sign-in (`git log -S signInWithPassword` on `main` is empty). The page is not linked from the sign-in screen; it is kept only to complete a recovery link safely. | PLATFORM |

## Not present in mobile `main` (removed from or disabled in the web)

All of these exist only on the unmerged mobile branches `antigravity/chat-photo-resonance-fix-2026-09-17`, `antigravity/chat-photo-fix-2026-09-17` and `antigravity/current-work-2026-09-10` (all at commit `e2d5e6c`, 9 commits ahead of `main`). They are **not** production contracts for the web. If any of them is already deployed to the live Supabase project, that is configuration drift (deployed backend not in `main`) that must be resolved in `ecoutemoi-mobile` first.

| Feature | Previously used by the web | Found only in (unmerged branch) | Status | Web behaviour now |
|---|---|---|---|---|
| Subscription source / store | `get_my_store_subscription_v1` | `supabase/migrations/20260905_zz_trust_scam_admin42_premium_release.sql` | NOT PRESENT | Replaced by `get_my_entitlement()`; no store, platform or payment source is shown |
| Sign-in methods RPC | `get_my_login_methods` | `supabase/migrations/20260902_auth_identities.sql` | NOT PRESENT | Replaced by `user.identities`; VK shown as «Нет данных» |
| Active sessions list | `get_my_active_sessions` | `supabase/migrations/20260905_account_portability_sessions.sql` | NOT PRESENT | «Просмотр активных сессий на сайте пока недоступен.»; no list, no count; only «Завершить другие сессии» (PLATFORM) |
| Data export | `export_my_account_data` | `supabase/migrations/20260905_account_portability_sessions.sql` | NOT PRESENT | «Экспорт данных через веб пока недоступен.»; no download button |
| Notification preferences | `get_my_notification_preferences_v1`, `update_my_notification_preferences_v1` | `supabase/migrations/20260906_managed_notifications.sql` | NOT PRESENT | Informational page; no switches, no save. Mobile `main` only enables push per device |
| Safety centre (sanctions, appeals, reports) | `get_my_safety_center_v1` | `supabase/migrations/20260905_zzz_user_safety_center.sql` | NOT PRESENT | Restriction status from `get_my_account_restriction()`; appeals and reports are not shown |
| Account deletion | Edge Function `delete-my-account` | `supabase/functions/delete-my-account/index.ts` | NOT PRESENT | Safe fallback page, no destructive control, link to the public «Удаление аккаунта» page |
| VK sign-in | (docs only) Edge Function `vk-id-auth` | `supabase/functions/vk-id-auth/index.ts` | NOT PRESENT | No VK on the web. In the branch implementation VK is not a Supabase identity provider (the function creates a user with a synthetic `@auth.ecoutemoi.invalid` email), so `user.identities` can never show VK |
| Auth setup notes | (docs only) `AUTH_SETUP.md` | `AUTH_SETUP.md` | NOT PRESENT | Reference removed |
| «Exclusive» plan name, plan copy | `honestPremium` wording | `src/features/dating/honestPremium.ts` | NOT PRESENT | Tier names as returned by the RPC: Free / Premium / Founder |

## Committed in `main` but deliberately not used

| Backend object | Evidence | Why the web does not use it |
|---|---|---|
| `submit_moderation_appeal(p_sanction_id uuid, p_reason text)` | `20260814_admin_operations_extensions.sql:110` | Needs the sanction id. No RPC or RLS policy in `main` lets a user read their own sanction id (`user_sanctions` is revoked from `authenticated`, `20260810_trust_safety_push.sql:67`), and the user must never type it. |
| `user_reports` own rows | Policy `user_reports_select_own`, `20260810_safety_foundation.sql:323` | Reporter-facing report status is not shown by mobile `main`; showing moderation outcomes on the web needs a product decision. |
| `begin_delete_my_dating_profile()`, `delete_my_dating_profile()` | `20260810_delete_dating_profile.sql:7`, `:56` | They reset the dating profile («Удалить карточку» in mobile, `DatingExperience.tsx:4401`) and keep the auth account; they are not account deletion. |
| `set_my_nearby_opt_in(boolean)`, `update_my_privacy_settings(...)` | `20260820_chat_product_premium.sql:10`, `20260810_safety_foundation.sql:338` | The web shows privacy state read-only; changes stay in the app. |

## Known mismatches outside the web app (release blockers)

1. The public page `/account-deletion/` says the app has «Удалить аккаунт» with a three-minute timer. Mobile `main` offers «Удалить карточку» (`DatingExperience.tsx:4401`, `:6242`), which resets the dating profile and keeps the auth account. The owner must reconcile the public text with the real mobile flow before production.
2. `/terms/`, `/privacy/` and `/community/` on the public site are placeholders («В ПОДГОТОВКЕ»).
3. The unmerged branch objects listed above may already be deployed in the live Supabase project: the branch head `e2d5e6c` is "chore(checkpoint): prepare latest iOS TestFlight build". This was not checked; confirm with a read-only query or `supabase migration list`, then merge or remove them in `ecoutemoi-mobile`.
