# Web 2.0 parity audit — 16 October 2026

Source bases: site `43ff0aabe9ebb49c7b8f369424df3a8fde611b32`, mobile `e6be69b193b81848ab5b282b6390da413e82ac2f`.
Branch: `feat/web-ios-parity-free-auth`. Production is not changed by this branch.

| Feature | iOS source contract | Web at base | Required work / risk |
|---|---|---|---|
| Letters / voice responses | `src/services/audioLetters.ts`, `20261001120000_audio_letters_mutual_disclosure.sql` | gate to iPhone | implement feed, publishing, response/thread audio, explicit disclosure; never fall back to legacy photo reveal |
| Disclosure | `set_disclosure_consent_v1`, `get_my_disclosed_profiles_v1` | legacy resonance | expose profiles only from disclosed profiles RPC; server remains authority |
| Chat photos | `cloudChat.ts`, chat-media / consume_image_message | text labels | private upload and explicit view-once consumption, expiry and modal cleanup |
| Emoji / reactions | brandedEmojiCatalog.ts / get_message_reactions / toggle_message_reaction | text labels | original assets and keys; refresh reactions on events and focus |
| Moments | chatProduct.ts timeline from visible messages | missing | derive from history; no recording in chat |
| Auth | oauth-broker / vk-id-auth | standard OAuth disabled | custom broker browser returns required; native Apple is not browser Apple |
| Free access | `20261003154352_free_launch_access.sql` | commercial UI | remove active commercial presentation, preserve entitlement/history |
| Account deletion | delete-my-account, Apple revocation | old request | preserve fail-closed deletion, support server-required Apple reauthentication |

Backend existence in committed main is SOURCE verification. Deployed functions, release cohort, a released iPhone binary and real cross-device/OAuth QA require separate evidence. Synthetic tests cannot establish these facts.

Legal texts from site main dated 14 October are retained. Source checkout `Licom/mobile` has unrelated dirty changes; contracts are read from a separate clean checkout of mobile main.
