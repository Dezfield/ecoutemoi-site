# Web app backend capability matrix

This matrix is the source of truth for which backend objects the web app (`app/`, app.ecoutemoi.ru) may use. Re-check it before every deployment and whenever account, auth or product API code changes.

**Backend source of truth:** `Dezfield/ecoutemoi-mobile`, branch `main`, commit `3098d8ca711180dffdf4e2da94b6ced98efbb8d1` (2026-09-26, merge of PR #13 "block and unblock deletion guards"; includes PR #12 "report and read-marker deletion guards", PR #10 "communication deletion guards", PR #5 "account deletion lifecycle + stale-JWT guards" and PR #8). Line numbers below refer to that commit. PR #10, PR #12 and PR #13 only added `supabase/migrations/20260925120000_communication_deleted_account_guards.sql`, `20260926120000_report_read_deletion_guards.sql` and `20260926130000_block_deletion_guards.sql`, their tests and CI steps, so every earlier file and line is unchanged since `9cb6500`.

**Production check (2026-09-24, read-only):** project `btxqktrxlsvamwimxuhu`. Every RPC listed as VERIFIED exists, is executable by `authenticated` and not by `anon`; the seven account RPCs marked *guarded* start with `perform private.require_existing_account();` (identical to main, verified after the PR #5 rollout). `delete-my-account` is deployed as version 2 with `verify_jwt` on; its live source is byte-identical to main. The CHECK constraints of `user_sanctions`, `moderation_appeals` and `user_reports` match main.

**Production check (2026-09-26, communication):** before the PR #10 rollout, the bodies (line endings normalised), arguments, results, volatility, SECURITY DEFINER and `search_path` of the 15 guarded communication RPCs and of `get_voice_candidates`/`_v3`/`_v4`, `block_user`, `submit_user_report`, `prepare_my_dating_media`, `save_my_dating_profile` and `get_my_dating_profile_v5` matched main (24/24). After the rollout, the 15 public names are guard wrappers, and the original bodies are unchanged under `*_pre_deletion_guard_v1`, which `anon` and `authenticated` cannot execute. The same pattern was applied the same day to `submit_user_report` and `mark_conversation_read` (PR #12) and to `block_user` and `unblock_user` (PR #13); their bodies matched main before each rollout.

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
| Unblock | `unblockUser()` | RPC `unblock_user(p_blocked_user_id)`; actor is `auth.uid()` | `20260810_safety_foundation.sql:431`, grant `:868`; deletion guard `20260926130000_block_deletion_guards.sql` (production verified) | VERIFIED |
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

## Communication contracts audited for full web experience

Source: mobile `main` at `3098d8ca711180dffdf4e2da94b6ced98efbb8d1`. The entries below are source-verified and were compared with live production on 2026-09-26 (see the production check above). All calls require an `authenticated` Supabase JWT and use the publishable key. `YES` means usable in a browser under the existing RLS / Storage rules; the deleted-account behaviour is described below. No new web-only backend objects are introduced.

| Area | Exact contract, arguments and return | Authorization / mobile source | Browser-safe | Web use and limits |
|---|---|---|---|---|
| VOICES / DISCOVERY | `get_voice_candidates_v4(p_limit integer=10)` → rows `{impression_id,prompt_key,audio_path,audio_duration_seconds,presented_at,age,city,relationship_goal,interests,languages,shared_interests,shared_values,meeting_readiness,preferred_formats,shared_formats,match_reason_codes,match_score}` | `src/services/dating.ts:643`; v4 `20260813_voice_letter_chat_safety.sql:271` composes `get_voice_candidates`; the latest base in `20260828_premium_discovery_v1.sql` also requires `private.current_user_account_is_active(auth.uid())` | YES | Used by `/voices`; only the reduced pre-resonance fields are rendered. RPC creates/returns up to ten daily impressions, so loading has a backend side effect. Impressions created by a call are not returned by that same call (the outer SQL statement does not see them); they appear on the next load (mobile has the same behaviour). The web therefore asks exactly once more when the first answer is empty and shows the empty state only if the second answer is empty too; there is no polling. |
| RESPONSES | `respond_to_voice_candidate_v2(p_impression_id uuid,p_interested boolean,p_interest_reason text)` → `{result_status,resonance_id}` | `src/services/dating.ts:708`; `20260813_voice_letter_chat_safety.sql:404`; base `20260810_voice_dating_mvp.sql:824` locks impression and requires `viewer_id=auth.uid()`, rejects duplicate decision and block | YES | Used after explicit click, once per pending request. `interest_reason` is one of thought/voice/values/curious. Success only after RPC reply. |
| Daily status | `get_my_daily_voice_status()` → `{daily_limit,presented_today,decided_today,pending_today,remaining_today,resets_at}` | `src/services/dating.ts:685`; `20260820_relationship_lifecycle_voice10.sql:534` filters `viewer_id=auth.uid()` | YES | Available, not yet used; page relies on actual list. |
| RESONANCES / PROFILE REVEAL | `get_my_resonances_v6()` → `{resonance_id,contact_id,display_name,about,age,city,relationship_goal,interests,languages,photo_paths,my_photo_decision,stage,conversation_id,resonated_at,profile_values,children_preference,smoking_code,alcohol_code,communication_pace,what_matters,meeting_readiness,preferred_formats,shared_values,shared_formats,match_reason_codes,zodiac_sign,country_code}` | `src/services/dating.ts:735`; v6 `20260813_country_city_selection.sql:55` → v5/v4 → base `20260810_voice_dating_mvp.sql:932`, which filters `auth.uid()` participant and `closed_at is null` | YES | Used by `/resonances`. These profile/photo paths are returned only after resonance. Direct lookup by supplied resonance ID is not used. |
| MUTUALITY | `respond_to_photo_resonance(p_resonance_id uuid,p_interested boolean)` → `{result_status,opened_conversation_id}` | `src/services/dating.ts:839`; `20260810_voice_dating_mvp.sql:961`; RPC verifies current user is participant and opens conversation on reciprocal interest | YES | Used by `/resonances`; conversation link appears only when returned in resonance list. |
| CONVERSATIONS | `get_my_inbox_v2()` → rows `{conversation_id,contact_id,contact_name,contact_avatar_path,last_message_text,last_message_at,unread_count,contact_last_read_at,blocked_by_me,blocked_by_contact,lifecycle_status,lifecycle_changed_at,lifecycle_changed_by_me,success_request_pending,success_requested_by_me,history_save_requested_by_me,contact_history_save_requested,history_saved,comfort_state,contact_restricted,theme_key,has_planned_meeting,message_count}` | `src/services/cloudChat.ts:849`; `20260820_relationship_lifecycle_voice10.sql:126` starts from `conversation_members.user_id=auth.uid()` | YES | Used by `/chats` and detail membership gate. Web does not read `conversations` directly. |
| MESSAGES read | `messages.select(...).eq('conversation_id',id).order('created_at',descending).lt('created_at',before).limit(31)` | `src/services/cloudChat.ts:998`; `messages_select_members` invokes `private.can_view_chat_message` (`20260813_voice_letter_chat_safety.sql:93,121`), later redefined in `20260825_zz_admin_center_v3.sql` to reject a viewer whose `profiles.deleted_at` is set | YES | Used with 30-item pages and ID dedupe. A foreign UUID returns no rows; detail also requires inbox membership. Non-text media is not rendered as a private URL in this phase. |
| MESSAGES send | `messages.insert({conversation_id,sender_id,body,message_type:'text',client_message_id})`; `body` 1–4000 characters | `src/services/cloudChat.ts:1300-1390`; `messages_insert_members` `20260810_safety_foundation.sql:296` requires `sender_id=auth.uid()` and `private.can_interact_in_conversation`; the helper was redefined in `20260825_zz_admin_center_v3.sql` to require an active account. Trigger enforces rate limit, sanctions, duplicate text; `20260811_message_client_id_grant.sql:5` and unique `(sender_id,client_message_id)` | YES | Used only for text. One stable client ID is reused on retry, `23505` means previous send succeeded; no optimistic phantom messages. Server rows are reloaded after send. |
| MESSAGES read marker | `mark_conversation_read(p_conversation_id uuid)` → void; moves only the caller's own `conversation_members.last_read_at` | `src/services/cloudChat.ts:2078` (mobile calls it when a chat opens and on new messages in the open chat); `supabase/schema.sql:575`, grant `:801`; rejects a non-member with `42501`; deletion guard `20260926120000_report_read_deletion_guards.sql` | YES | Called by `/chats/:conversationId` after the history is loaded when the inbox reports `unread_count > 0`, and again on realtime refresh. No user id is sent. A failure leaves the counter unchanged and shows a quiet notice; the chat stays readable and writable. |
| REALTIME | `postgres_changes` on `public.messages`, filter `conversation_id=eq.<member conversation ID>` | Mobile subscribes in `src/services/cloudChat.ts:2190`; Postgres changes under JWT/RLS | YES | Web subscribes only after the conversation appears in own inbox; removes channel on route change/logout. Re-fetch and ID dedupe reconcile events. |
| BLOCKS | `block_user(p_blocked_user_id uuid)` | `src/services/cloudChat.ts:1170`; `20260810_safety_foundation.sql:387`; current actor from JWT; requires a shared conversation (`P0002` otherwise); deletion guard `20260926130000_block_deletion_guards.sql` (production verified) | YES | Used in chat; web disables send based on refreshed inbox block state. Backend RLS rejects blocked send. |
| REPORTS | `submit_user_report(p_reported_user_id,p_conversation_id,p_message_id,p_category,p_details)` → report UUID or null when limited; `report_dating_candidate(p_impression_id,p_category,p_details,p_block_user)` → UUID; `report_dating_resonance_content(p_resonance_id,p_content_type,p_content_reference)` → UUID | `src/services/cloudChat.ts:1187`, `src/services/dating.ts:906,922`; `20260810_safety_foundation.sql:472`, `20260810_voice_dating_mvp.sql:1079`, `20260813_voice_letter_chat_safety.sql:586`; chat membership, own impression or resonance participation are verified by backend | YES | Used in chat, voice and resonance views. Five fixed voice/chat categories. Voice and resonance report also block the contact as mobile does. |
| MEDIA | `storage.from('dating-audio' / 'dating-photos').createSignedUrl(path,600)` | `src/services/dating.ts:422`; private Storage SELECT policies `20260810_voice_dating_mvp.sql:325,381` use `private.can_access_dating_audio/photos` | YES | Used for voice playback and revealed resonance photos. URLs last ten minutes, never persisted. Buckets stay private. |
| Own recording | `get_my_dating_profile_v5()` → own existing profile fields; `prepare_my_dating_media()` → `{audio_path}`; private `dating-audio.upload(audio_path, Blob, contentType:'audio/webm' or 'audio/mp4',upsert:true)`; `save_my_dating_profile(p_display_name,p_birth_date,p_city,p_gender_code,p_looking_for,p_relationship_goal,p_interests,p_languages,p_preferred_min_age,p_preferred_max_age,p_audio_prompt_key,p_audio_path,p_audio_duration_seconds,p_photo_paths,p_discovery_enabled)` → void | `src/services/dating.ts:525-600`; `20260810_voice_dating_mvp.sql:438,514`, latest save replacement `20260825_zzz_card_options.sql:39`; private bucket accepts both MIME types (`20260810_voice_dating_mvp.sql:128`); duration 20–45 seconds by `20260813_voice_letter_chat_safety.sql:166` | YES for browsers with WebM/Opus or MP4 MediaRecorder | Used by `/voices/record` only for an already completed profile, carrying the current full base profile fields and photos forward. If codec unavailable, recording is disabled and listening/chat remain available. Blob limit 3 MB. |

### Deleted account with an old JWT: DEPLOYED / VERIFIED IN PRODUCTION

`20260921120100_account_rpc_deletion_guards.sql` guards the account, notification and safety RPCs. [Mobile PR #10](https://github.com/Dezfield/ecoutemoi-mobile/pull/10) (merge `fbe9058`, `20260925120000_communication_deleted_account_guards.sql`) adds the same `private.require_existing_account()` check in front of 15 communication RPCs:
`get_my_resonances` … `get_my_resonances_v6`, `get_my_inbox`, `get_my_inbox_v2`, `get_my_daily_voice_status`, `respond_to_voice_candidate`, `respond_to_voice_candidate_v2`, `respond_to_photo_resonance`, `report_dating_candidate`, `report_dating_resonance`, `report_dating_resonance_content`.

Each public name is now a wrapper with the original signature, result, owner and grants.

Membership and resonances still exist between `prepare_user_account_deletion_v1` and `complete_user_account_deletion_v1`. The rollout was checked on 2026-09-26 in production (`btxqktrxlsvamwimxuhu`) on hidden QA accounts, using a JWT issued before preparation and still valid. In that window:
- all 15 RPCs answer `403 42501 Account is unavailable`, with no data (including `get_my_inbox_v2` and `get_my_resonances_v6`);
- `messages` SELECT returns no rows and INSERT is rejected with `42501`. The message RLS in `20260825_zz_admin_center_v3.sql` already enforced this;
- no signed URL is issued for the partner's or the account's own dating audio and photo;
- the other participant keeps an unchanged inbox, resonance, voice status and message history, and can still send.

Active accounts go through voice → response → resonance → photo decision → mutuality → inbox → message on the wrappers with unchanged results.

`get_voice_candidates_v4`, `prepare_my_dating_media` and `save_my_dating_profile` reject a prepared account through their existing checks.

[Mobile PR #12](https://github.com/Dezfield/ecoutemoi-mobile/pull/12) (merge `7352543`, `20260926120000_report_read_deletion_guards.sql`) adds the same guard to `submit_user_report` and `mark_conversation_read`, which the web chat uses. It was verified live on 2026-09-26 with a pre-deletion JWT:
- in the prepared window and after completed deletion, both RPCs answer `403 42501 Account is unavailable`;
- no report is written and the read marker does not move;
- the other participant can still send, mark read and reach the report RPC.

The membership checks, the 5-per-hour / 20-per-day report rate limits and the 24-hour duplicate-report reuse are unchanged; tests compare them with and without the migration.

[Mobile PR #13](https://github.com/Dezfield/ecoutemoi-mobile/pull/13) (merge `3098d8c`, `20260926130000_block_deletion_guards.sql`) guards `block_user` and `unblock_user`. It was verified live on 2026-09-26 with a pre-deletion JWT:
- prepared and fully deleted accounts get `403 42501` from both RPCs;
- an existing block row stays unchanged;
- an active account and the other participant can still block and unblock, with non-contact `P0002` and self `22023` unchanged.

Mobile-only chat RPCs (presence, reactions, theme, contact removal, invite codes) are not wrapped yet; the web does not use them and they are tracked as a separate hardening backlog. The web does not rely on the frontend for deleted-account safety: after a successful deletion it clears the session and shows `/account-deleted`.
