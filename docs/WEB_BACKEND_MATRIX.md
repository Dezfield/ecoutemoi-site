# Web 2.0 backend matrix

Mobile main: `e6be69b193b81848ab5b282b6390da413e82ac2f`. Site base: `43ff0aabe9ebb49c7b8f369424df3a8fde611b32`.

Baseline frontend RPCs have a committed-main source and argument signature below. Legal acceptance calls added on 19 October are declared separately as undeployed candidate contracts. Source verification is separate from deployed verification. Account/RLS ownership and deleted-account guards remain server-owned. No browser identity is chosen from a request parameter.

## Legal candidate — not deployed

Source: mobile `2498cc9888f603ca3fbcdab73a51092344ce5930`, branch `release/prelaunch-ios-2026-10-18`.
Required migrations: `20261018120000_legal_acceptance.sql`, `20261018120100_account_deletion_selfie_cleanup.sql`, `20261019061807_legal_consent_hardening.sql`.

| RPC | Arguments | Candidate source |
|---|---|---|
| get_my_legal_acceptance_v1 | none | 20261018120000; state extended by 20261019061807 |
| accept_legal_documents_v1 | p_documents jsonb, p_platform text, p_app_version text | 20261018120000 |
| withdraw_legal_consent_v1 | p_doc_type text, p_platform text, p_app_version text | 20261018120000 |

All three run for the JWT subject, with no user id supplied by the browser. The browser sends exact local document versions and hashes. Missing legacy registry preserves existing mandatory-account access; new audio publication stays closed until the consent backend is available. Other legal-check errors keep private pages unmounted. The candidate contract file is `app/tests/backend-candidate-contracts.json`; it must not be presented as verified production state.

The public privacy text and web consent copies have edition 2026-10-19; Terms remain 2026-10-14. Before enabling server enforcement, deploy the matching web build and compatible mobile release. This candidate does not change signup, OAuth provider flags, audio rollout or publication settings.

| RPC | Arguments | Committed source |
|---|---|---|
| `mark_conversation_read` | `p_conversation_id uuid` | `supabase/schema.sql:575` |
| `block_user` | `p_blocked_user_id uuid` | `supabase/migrations/20260810_safety_foundation.sql:387` |
| `get_my_blocked_users` | `` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:1419` |
| `submit_user_report` | `p_reported_user_id uuid, p_conversation_id uuid, p_message_id uuid, p_category text, p_details text` | `supabase/migrations/20260810_safety_foundation.sql:472` |
| `unblock_user` | `p_blocked_user_id uuid` | `supabase/migrations/20260810_safety_foundation.sql:431` |
| `get_message_reactions` | `p_message_ids uuid[]` | `supabase/migrations/20260811_message_reactions.sql:118` |
| `toggle_message_reaction` | `p_message_id uuid, p_reaction_code text` | `supabase/migrations/20260811_message_reactions.sql:39` |
| `get_my_dating_profile_v5` | `` | `supabase/migrations/20260813_country_city_selection.sql:38` |
| `delete_chat_message_for_everyone` | `p_message_id uuid` | `supabase/migrations/20260825_zz_admin_center_v3.sql:584` |
| `edit_chat_message` | `p_message_id uuid, p_body text` | `supabase/migrations/20260813_voice_letter_chat_safety.sql:437` |
| `submit_moderation_appeal` | `p_sanction_id uuid, p_reason text` | `supabase/migrations/20260921120100_account_rpc_deletion_guards.sql:351` |
| `consume_image_message` | `p_message_id uuid` | `supabase/migrations/20260820_chat_product_premium.sql:409` |
| `get_my_entitlement` | `` | `supabase/migrations/20261003154352_free_launch_access.sql:9` |
| `get_my_inbox_v2` | `` | `supabase/migrations/20260820_relationship_lifecycle_voice10.sql:126` |
| `get_my_login_methods` | `` | `supabase/migrations/20260925160000_apple_google_broker.sql:548` |
| `export_my_account_data` | `` | `supabase/migrations/20260921120100_account_rpc_deletion_guards.sql:136` |
| `get_my_active_sessions` | `` | `supabase/migrations/20260921120100_account_rpc_deletion_guards.sql:104` |
| `get_my_safety_center_v1` | `` | `supabase/migrations/20260921120100_account_rpc_deletion_guards.sql:253` |
| `get_my_notification_preferences_v1` | `` | `supabase/migrations/20260921120100_account_rpc_deletion_guards.sql:414` |
| `update_my_notification_preferences_v1` | `p_messages_enabled boolean, p_dating_enabled boolean, p_product_enabled boolean, p_quiet_hours_enabled boolean, p_quiet_start text, p_quiet_end text, p_timezone text, p_delivery_mode text` | `supabase/migrations/20260921120100_account_rpc_deletion_guards.sql:445` |
| `end_voice_thread_v1` | `p_thread_id uuid` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2422` |
| `get_audio_letter_feed_v1` | `p_limit integer default 5` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:1939` |
| `get_my_audio_letters_v1` | `` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:1732` |
| `get_my_disclosed_profiles_v1` | `` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2563` |
| `get_my_voice_threads_v1` | `` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2210` |
| `get_voice_thread_v1` | `p_thread_id uuid` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2235` |
| `mark_audio_letter_listened_v1` | `p_impression_id uuid, p_completed boolean default false` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2042` |
| `mark_voice_thread_message_listened_v1` | `p_message_id uuid` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2373` |
| `prepare_voice_upload_v1` | `p_purpose text` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:1777` |
| `publish_audio_letter_v1` | `p_storage_path text, p_duration_seconds integer, p_topic_key text, p_title text default null` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:1801` |
| `report_voice_content_v1` | `p_target_type text, p_target_id uuid, p_category text, p_details text default '', p_block_user boolean default true` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2653` |
| `send_letter_response_v1` | `p_impression_id uuid, p_storage_path text, p_duration_seconds integer, p_client_message_id uuid, p_anchor_timestamp_ms integer default null` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2104` |
| `send_voice_thread_message_v1` | `p_thread_id uuid, p_storage_path text, p_duration_seconds integer, p_client_message_id uuid` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2275` |
| `set_audio_letter_status_v1` | `p_letter_id uuid, p_status text` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:1874` |
| `set_disclosure_consent_v1` | `p_thread_id uuid, p_consent boolean` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2456` |
| `skip_audio_letter_v1` | `p_impression_id uuid` | `supabase/migrations/20261001120000_audio_letters_mutual_disclosure.sql:2075` |

## Deployed verification on 16 October 2026

Read-only inspection of Beget PostgreSQL 17.6 confirmed the letter feed, voice upload/publishing, thread, disclosure, message reaction, photo consumption and message editing/deletion contracts. Checked functions are executable by authenticated and not by anon. All three media buckets are private. The free policy returns tier=free and grants the former feature privileges to active accounts; historical paid rows are retained.

`audio_letters_v1`: enabled, canary, kill_switch=false, rollout_percentage=0. This is NOT a global rollout; the UI uses the current caller response of get_my_audio_letters_v1 and never falls back to old discovery.

oauth-broker, vk-id-auth, delete-my-account-v2 and voice-media-link are deployed. The web callback code is NOT deployed. Web readiness flags are false and Apple web identifiers/secrets are absent. Native Apple/Google readiness does not imply web readiness.

## Browser auth change (separate backend PR)

Google and Apple use oauth-broker. VK keeps vk-id-auth. Each returns a one-time ticket bound to a verifier held by the browser tab; linking requires the starting and finishing account JWT and never redeems a replacement session. The only HTTPS return accepted is https://app.ecoutemoi.ru/auth/broker/callback. Apple uses a Services ID, code exchange and form_post to the server callback, with real signature/audience/nonce verification. The VK state RPC needs the reviewed additive migration in the backend PR.

Apple-linked account deletion uses v2 preflight and refuses to bypass Apple authorization. Browser Apple deletion proof is not implemented: complete that deletion in iPhone until a separately reviewed web revocation proof and persisted grant/client binding exist. Email/Google/VK account deletion without a required Apple proof uses the existing v2 server flow.

The JSON allowlist in app/tests/backend-main-contracts.json is pinned evidence, not generated by test runs. E2E mocks enforce backend names and do not prove external providers or iPhone interoperability.
