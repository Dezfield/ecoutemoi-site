import type { LoginMethod, LoginProvider } from '../auth/types';
import { requireSupabase } from '../lib/supabase';
import type {
  AccountSession,
  AccountSummary,
  AppealStatus,
  BlockedUser,
  DatingProfile,
  Entitlement,
  NotificationDeliveryMode,
  NotificationPreferences,
  PremiumTier,
  ReportStatus,
  SafetyCenter,
  SafetySanction,
  SanctionKind,
} from './types';

/**
 * Account data access for the web app. Every call runs as the signed-in user
 * with the publishable key and is authorised by RLS policies and SECURITY
 * DEFINER RPCs committed in ecoutemoi-mobile main (supabase/migrations) and the
 * protected delete-my-account Edge Function (supabase/functions). Each
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
  if (/account is unavailable/.test(message)) return 'Аккаунт недоступен: он удалён или ещё не создан.';
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

const loginProviders: LoginProvider[] = ['apple', 'google', 'vk', 'email'];

/**
 * Sign-in methods through get_my_login_methods() (mobile main
 * supabase/migrations/20260921120100_account_rpc_deletion_guards.sql). The RPC
 * returns one entry per provider — apple, google, vk, email — with
 * `connected` and a display `label`; the web shows exactly that. Showing a
 * connected VK identity does not enable VK sign-in on the web.
 */
export async function loadLoginMethods(): Promise<LoginMethod[]> {
  const { data, error } = await requireSupabase().rpc('get_my_login_methods');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return loginProviders.map((provider) => {
    const row = asObject(rows.find((item) => asObject(item).provider === provider));
    return { provider, connected: row.connected === true, label: nullableStr(row.label) };
  });
}

/**
 * Active sessions through get_my_active_sessions() (same migration): only the
 * caller's own auth sessions with created/updated time, user agent, IP and a
 * `current_session` flag computed from the JWT session id. Nothing else about
 * the device is derived or shown.
 */
export async function loadActiveSessions(): Promise<AccountSession[]> {
  const { data, error } = await requireSupabase().rpc('get_my_active_sessions');
  if (error) throw error;
  return (Array.isArray(data) ? data : [])
    .map((item) => {
      const row = asObject(item);
      return {
        id: str(row.session_id),
        createdAt: str(row.created_at),
        updatedAt: str(row.updated_at),
        userAgent: nullableStr(row.user_agent),
        ipAddress: nullableStr(row.ip_address),
        current: row.current_session === true,
      };
    })
    .filter((session) => session.id);
}

/**
 * Ends every other session of this user (POST /auth/v1/logout?scope=others,
 * supported by supabase-js). The current browser stays signed in.
 */
export async function signOutOtherSessions(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut({ scope: 'others' });
  if (error) throw error;
}

/**
 * Own data export through export_my_account_data(). The server takes the
 * account from auth.uid(); the web passes no argument and only saves the
 * returned JSON as a file in the browser.
 */
export async function exportAccountData(): Promise<Json> {
  const { data, error } = await requireSupabase().rpc('export_my_account_data');
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Unexpected export payload.');
  return data as Json;
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const deliveryModes: NotificationDeliveryMode[] = ['instant', 'hourly', 'daily'];

/** Maps the jsonb returned by get_/update_my_notification_preferences_v1. */
function mapNotificationPreferences(value: unknown): NotificationPreferences {
  const row = asObject(value);
  return {
    messagesEnabled: row.messagesEnabled === true,
    datingEnabled: row.datingEnabled === true,
    productEnabled: row.productEnabled === true,
    quietHoursEnabled: row.quietHoursEnabled === true,
    quietStart: typeof row.quietStart === 'string' && timePattern.test(row.quietStart) ? row.quietStart : '22:00',
    quietEnd: typeof row.quietEnd === 'string' && timePattern.test(row.quietEnd) ? row.quietEnd : '08:00',
    timezone: str(row.timezone, 'UTC') || 'UTC',
    deliveryMode: deliveryModes.find((mode) => mode === row.deliveryMode) ?? 'instant',
  };
}

export function detectedTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === 'string' && timezone.length > 0 && timezone.length <= 64 ? timezone : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** get_my_notification_preferences_v1() — creates the default row on first read. */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await requireSupabase().rpc('get_my_notification_preferences_v1');
  if (error) throw error;
  return mapNotificationPreferences(data);
}

/** update_my_notification_preferences_v1(...) with exactly the eight server arguments. */
export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
  const { data, error } = await requireSupabase().rpc('update_my_notification_preferences_v1', {
    p_messages_enabled: preferences.messagesEnabled,
    p_dating_enabled: preferences.datingEnabled,
    p_product_enabled: preferences.productEnabled,
    p_quiet_hours_enabled: preferences.quietHoursEnabled,
    p_quiet_start: preferences.quietStart,
    p_quiet_end: preferences.quietEnd,
    p_timezone: preferences.timezone,
    p_delivery_mode: preferences.deliveryMode,
  });
  if (error) throw error;
  return mapNotificationPreferences(data);
}

const sanctionKinds: SanctionKind[] = ['warning', 'suspended', 'banned'];
const appealStatuses: AppealStatus[] = ['pending', 'reviewing', 'upheld', 'overturned'];
const reportStatuses: ReportStatus[] = ['open', 'reviewing', 'actioned', 'dismissed'];

function mapSanction(value: unknown): SafetySanction | null {
  const row = asObject(value);
  const kind = sanctionKinds.find((candidate) => candidate === row.kind);
  if (!kind || !str(row.id)) return null;
  const appeal = asObject(row.appeal);
  return {
    id: str(row.id),
    kind,
    reason: str(row.reason),
    startsAt: str(row.startsAt),
    expiresAt: nullableStr(row.expiresAt),
    appeal: str(appeal.id)
      ? {
          id: str(appeal.id),
          status: appealStatuses.find((candidate) => candidate === appeal.status) ?? 'pending',
          createdAt: str(appeal.createdAt),
        }
      : null,
  };
}

/**
 * Safety centre through get_my_safety_center_v1(): the active sanction (with
 * the server-issued id needed for an appeal), the caller's recent reports and
 * appeals. Only these fields of the jsonb contract are read.
 */
export async function loadSafetyCenter(): Promise<SafetyCenter> {
  const { data, error } = await requireSupabase().rpc('get_my_safety_center_v1');
  if (error) throw error;
  const root = asObject(data);
  const reports = Array.isArray(root.recentReports) ? root.recentReports : [];
  const appeals = Array.isArray(root.recentAppeals) ? root.recentAppeals : [];
  return {
    activeSanction: mapSanction(root.activeSanction),
    recentReports: reports
      .map((item) => {
        const row = asObject(item);
        return {
          id: str(row.id),
          category: str(row.category, 'other'),
          status: reportStatuses.find((candidate) => candidate === row.status) ?? 'open',
          createdAt: str(row.createdAt),
        };
      })
      .filter((report) => report.id),
    recentAppeals: appeals
      .map((item) => {
        const row = asObject(item);
        return {
          id: str(row.id),
          status: appealStatuses.find((candidate) => candidate === row.status) ?? 'pending',
          sanctionKind: sanctionKinds.find((candidate) => candidate === row.sanctionKind) ?? null,
          createdAt: str(row.createdAt),
        };
      })
      .filter((appeal) => appeal.id),
    hasMoreReports: root.hasMoreReports === true,
  };
}

/**
 * submit_moderation_appeal(p_sanction_id, p_reason). The sanction id always
 * comes from loadSafetyCenter(); the user never types it. The server checks
 * that the sanction belongs to auth.uid() and is active.
 */
export async function submitAppeal(sanctionId: string, reason: string): Promise<void> {
  const normalized = reason.trim();
  if (normalized.length < 20 || normalized.length > 1500) {
    throw new Error('Опишите ситуацию текстом от 20 до 1500 символов.');
  }
  const { error } = await requireSupabase().rpc('submit_moderation_appeal', {
    p_sanction_id: sanctionId,
    p_reason: normalized,
  });
  if (error) throw error;
}

export function appealErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('Опишите')) return error.message;
  const message = (error instanceof Error ? error.message : str(asObject(error).message)).toLowerCase();
  if (message.includes('too many appeal')) return 'Слишком много обращений. Попробуйте снова завтра.';
  if (message.includes('sanction is not active')) return 'Ограничение уже завершено или отменено. Обновите статус.';
  return accountErrorMessage(error);
}

/**
 * Account deletion through the protected `delete-my-account` Edge Function
 * (mobile main supabase/functions/delete-my-account/index.ts). The function
 * takes the account from the caller's JWT via auth.getUser(); the browser
 * sends only the confirmation phrase — no user id and no service key. Success
 * is reported only for HTTP 200 with `{ deleted: true }`.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke('delete-my-account', {
    body: { confirmation: 'delete-my-account' },
  });
  if (error) throw error;
  if (asObject(data).deleted !== true) throw new Error('Account deletion was not confirmed.');
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
