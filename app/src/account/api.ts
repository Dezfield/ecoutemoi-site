import type { LoginMethod } from '../auth/types';
import { requireSupabase } from '../lib/supabase';
import type {
  AccountRestriction,
  AccountSummary,
  BlockedUser,
  DatingProfile,
  Entitlement,
  PremiumTier,
} from './types';

/**
 * Account data access for the web app. Every call runs as the signed-in user
 * with the publishable key and is authorised by RLS policies and SECURITY
 * DEFINER RPCs committed in ecoutemoi-mobile main (supabase/migrations). Each
 * backend object used here is listed with its source in
 * docs/WEB_BACKEND_MATRIX.md; objects that are not in mobile main are not
 * called. Nothing here accepts a user id from the UI for write operations:
 * the server derives the actor from auth.uid().
 */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const firstRow = (value: unknown): Json => asObject(Array.isArray(value) ? value[0] : value);
const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const nullableStr = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const num = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Maps backend errors to neutral Russian text; raw server messages are not shown. */
export function accountErrorMessage(error: unknown): string {
  const record = asObject(error);
  const message = (error instanceof Error ? error.message : str(record.message)).toLowerCase();
  const code = str(record.code).toLowerCase();
  if (/failed to fetch|network|load failed|offline/.test(message)) {
    return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.';
  }
  if (code === 'pgrst202' || /does not exist|schema cache|could not find the function/.test(message)) {
    return 'Эта функция ещё не включена на сервере Écoute Moi.';
  }
  if (code === '28000' || code === 'pgrst301' || /jwt|not authenticated|нужна авторизация|authentication required/.test(message)) {
    return 'Сессия истекла. Войдите снова.';
  }
  if (/too many|rate limit/.test(message)) return 'Слишком много запросов. Попробуйте позже.';
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

async function signedUrl(bucket: string, path: string, expiresIn = 15 * 60): Promise<string | null> {
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null; // a missing photo must not break the whole account page
  return data.signedUrl;
}

function mapDatingProfile(row: Json): DatingProfile {
  return {
    displayName: str(row.display_name),
    about: str(row.about),
    birthDate: nullableStr(row.birth_date),
    city: nullableStr(row.city),
    countryCode: nullableStr(row.country_code),
    genderCode: nullableStr(row.gender_code),
    lookingFor: strArray(row.looking_for),
    relationshipGoal: nullableStr(row.relationship_goal),
    interests: strArray(row.interests),
    languages: strArray(row.languages),
    profileValues: strArray(row.profile_values),
    childrenPreference: nullableStr(row.children_preference),
    smokingCode: nullableStr(row.smoking_code),
    alcoholCode: nullableStr(row.alcohol_code),
    communicationPace: nullableStr(row.communication_pace),
    whatMatters: str(row.what_matters),
    zodiacSign: nullableStr(row.zodiac_sign),
    preferredMinAge: num(row.preferred_min_age),
    preferredMaxAge: num(row.preferred_max_age),
    audioPromptKey: nullableStr(row.audio_prompt_key),
    audioPath: nullableStr(row.audio_path),
    audioDurationSeconds: num(row.audio_duration_seconds),
    photoPaths: strArray(row.photo_paths),
    onboardingComplete: row.onboarding_complete === true,
    discoveryEnabled: row.discovery_enabled === true,
  };
}

/**
 * Own dating profile through get_my_dating_profile_v5 — the RPC the mobile
 * app calls first in loadMyDatingProfile() (mobile main src/services/dating.ts).
 */
export async function loadDatingProfile(): Promise<DatingProfile | null> {
  const { data, error } = await requireSupabase().rpc('get_my_dating_profile_v5');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.length ? mapDatingProfile(asObject(rows[0])) : null;
}

export async function loadAccountSummary(userId: string, email: string | null): Promise<AccountSummary> {
  const client = requireSupabase();
  const [profileResult, dating] = await Promise.all([
    client.from('profiles').select('display_name, created_at').eq('id', userId).maybeSingle(),
    loadDatingProfile(),
  ]);
  if (profileResult.error) throw profileResult.error;
  const profileRow = asObject(profileResult.data);
  // As in mobile loadMyDatingProfile(): media is only resolved for a completed profile.
  const photoPath = dating?.onboardingComplete ? dating.photoPaths[0] : undefined;
  const photoUrl = photoPath ? await signedUrl('dating-photos', photoPath) : null;
  return {
    userId,
    email,
    displayName: dating?.displayName || str(profileRow.display_name) || 'Новый пользователь',
    createdAt: nullableStr(profileRow.created_at),
    dating,
    photoUrl,
  };
}

export async function loadProfileMedia(profile: DatingProfile): Promise<{ photoUrls: string[]; audioUrl: string | null }> {
  if (!profile.onboardingComplete) return { photoUrls: [], audioUrl: null };
  const [photoUrls, audioUrl] = await Promise.all([
    Promise.all(profile.photoPaths.map((path) => signedUrl('dating-photos', path))),
    profile.audioPath ? signedUrl('dating-audio', profile.audioPath) : Promise.resolve(null),
  ]);
  return { photoUrls: photoUrls.filter((url): url is string => Boolean(url)), audioUrl };
}

const premiumTiers: PremiumTier[] = ['free', 'premium', 'founder'];

/**
 * Premium status through get_my_entitlement() — the RPC mobile main reads in
 * loadCloudSnapshot() (src/services/cloudChat.ts). It always returns one row;
 * `is_premium` is null when the account has no entitlement row, which means
 * "not active". The RPC does not say how the status was obtained, so the web
 * does not show a store, platform or payment source.
 */
export async function loadEntitlement(): Promise<Entitlement> {
  const { data, error } = await requireSupabase().rpc('get_my_entitlement');
  if (error) throw error;
  const row = firstRow(data);
  const tier = premiumTiers.find((candidate) => candidate === row.tier) ?? 'free';
  const active = row.is_premium === true && tier !== 'free';
  return { tier: active ? tier : 'free', active, premiumUntil: nullableStr(row.premium_until) };
}

/**
 * Sign-in methods from the Supabase Auth user (GET /auth/v1/user). There is
 * no login-methods RPC in mobile main. Only standard Supabase identity
 * providers are reported as connected or not connected. VK is not a standard
 * Supabase identity provider, so its state cannot be read here and it is
 * shown as unknown instead of "not connected".
 */
export async function loadLoginMethods(): Promise<LoginMethod[]> {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  const user = data.user;
  const identities = user?.identities ?? [];
  const has = (provider: string) => identities.some((identity) => identity.provider === provider);
  return [
    { provider: 'email', state: has('email') ? 'connected' : 'not_connected', label: has('email') ? user?.email ?? null : null },
    { provider: 'phone', state: has('phone') ? 'connected' : 'not_connected', label: null },
    { provider: 'apple', state: has('apple') ? 'connected' : 'not_connected', label: null },
    { provider: 'google', state: has('google') ? 'connected' : 'not_connected', label: null },
    { provider: 'vk', state: 'unknown', label: null },
  ];
}

/**
 * Ends every other session of this user (POST /auth/v1/logout?scope=others,
 * supported by supabase-js). The current browser stays signed in. There is
 * no backend in mobile main that lists sessions, so the web cannot show them.
 */
export async function signOutOtherSessions(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut({ scope: 'others' });
  if (error) throw error;
}

/**
 * Own active suspension or ban through get_my_account_restriction()
 * (mobile main supabase/migrations/20260810_trust_safety_push.sql). Warnings
 * are not returned by this RPC; an empty result means no active restriction.
 */
export async function loadAccountRestriction(): Promise<AccountRestriction | null> {
  const { data, error } = await requireSupabase().rpc('get_my_account_restriction');
  if (error) throw error;
  const row = firstRow(data);
  const kind = row.sanction === 'suspended' || row.sanction === 'banned' ? row.sanction : null;
  if (!kind) return null;
  return { kind, reason: str(row.reason), expiresAt: nullableStr(row.expires_at) };
}

/** get_my_blocked_users() — the RPC mobile main reads in loadCloudSnapshot(). */
export async function loadBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await requireSupabase().rpc('get_my_blocked_users');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((item) => {
    const row = asObject(item);
    return { id: str(row.user_id), name: str(row.display_name, 'Пользователь'), blockedAt: str(row.blocked_at) };
  }).filter((user) => user.id);
}

/** Uses the unblock_user RPC (actor = auth.uid()), like mobile main unblockCloudUser(). */
export async function unblockUser(blockedUserId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('unblock_user', { p_blocked_user_id: blockedUserId });
  if (error) throw error;
}

/**
 * Own row of privacy_settings: RLS policy privacy_settings_select_self allows
 * a user to read only their own row. Mobile main reads it the same way in
 * loadCloudSnapshot(); changes go through RPCs in the app.
 */
export async function loadNearbyOptIn(userId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('privacy_settings')
    .select('nearby_opt_in')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return asObject(data).nearby_opt_in === true;
}
