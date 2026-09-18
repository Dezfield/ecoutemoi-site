import type { LoginMethod, LoginProvider, AccountSession } from '../auth/types';
import { requireSupabase } from '../lib/supabase';
import type {
  AccountSummary,
  AppealStatus,
  BlockedUser,
  DatingProfile,
  NotificationDeliveryMode,
  NotificationPreferences,
  PremiumTier,
  ReportStatus,
  SafetyCenter,
  SafetySanction,
  SanctionKind,
  StoreSubscription,
} from './types';

/**
 * Account data access for the web app. Every call runs as the signed-in
 * user with the publishable key, so it is authorised by the same RLS
 * policies and SECURITY DEFINER RPCs as the mobile app (see
 * ecoutemoi-mobile/src/services/*.ts and supabase/migrations). Nothing here
 * accepts a user id from the UI for write operations: the server derives the
 * actor from auth.uid().
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

/** Own dating profile via the same RPC the mobile app uses (get_my_dating_profile_v5). */
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
  // Mirrors mobile: photos are only resolved for a completed profile.
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

/** Subscription state; `web` is the platform value the RPC itself defaults to. */
export async function loadSubscription(): Promise<StoreSubscription> {
  const { data, error } = await requireSupabase().rpc('get_my_store_subscription_v1', { p_platform: 'web' });
  if (error) throw error;
  const row = firstRow(data);
  const tier = str(row.tier, 'free');
  return {
    tier: (tier === 'premium' || tier === 'founder' ? tier : 'free') as PremiumTier,
    active: row.active === true,
    premiumUntil: nullableStr(row.premium_until),
    source: str(row.source, 'none'),
    storePlatform: nullableStr(row.store_platform),
  };
}

function providerFromIdentity(provider: string): LoginProvider | null {
  return provider === 'email' || provider === 'apple' || provider === 'google' ? provider : null;
}

/** Same source and fallback as mobile getLoginMethods(). Read-only on web. */
export async function loadLoginMethods(): Promise<LoginMethod[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_my_login_methods');
  if (!error && Array.isArray(data)) {
    return data.map((item) => {
      const row = asObject(item);
      const provider = str(row.provider) as LoginProvider;
      return {
        provider,
        connected: row.connected === true,
        identityId: nullableStr(row.identityId ?? row.identity_id),
        label: nullableStr(row.label),
      };
    }).filter((method) => ['apple', 'google', 'vk', 'email'].includes(method.provider));
  }
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const identities = userData.user?.identities ?? [];
  return (['apple', 'google', 'vk', 'email'] as LoginProvider[]).map((provider) => {
    const identity = identities.find((item) => providerFromIdentity(item.provider) === provider);
    return {
      provider,
      connected: Boolean(identity),
      identityId: identity?.id ?? null,
      label: provider === 'email' ? userData.user?.email ?? null : null,
    };
  });
}

export async function loadActiveSessions(): Promise<AccountSession[]> {
  const { data, error } = await requireSupabase().rpc('get_my_active_sessions');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((item) => {
    const row = asObject(item);
    return {
      id: str(row.session_id),
      createdAt: str(row.created_at),
      updatedAt: str(row.updated_at),
      userAgent: nullableStr(row.user_agent),
      ipAddress: nullableStr(row.ip_address),
      current: row.current_session === true,
    };
  });
}

export async function signOutOtherSessions(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut({ scope: 'others' });
  if (error) throw error;
}

/** Portable JSON export of the requester's own data (export_my_account_data). */
export async function exportAccountData(): Promise<Json> {
  const { data, error } = await requireSupabase().rpc('export_my_account_data');
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Unexpected export payload.');
  }
  return data as Json;
}

export async function loadBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await requireSupabase().rpc('get_my_blocked_users');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((item) => {
    const row = asObject(item);
    return { id: str(row.user_id), name: str(row.display_name, 'Пользователь'), blockedAt: str(row.blocked_at) };
  }).filter((user) => user.id);
}

/** Uses the unblock_user RPC (actor = auth.uid()), exactly like mobile unblockCloudUser(). */
export async function unblockUser(blockedUserId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('unblock_user', { p_blocked_user_id: blockedUserId });
  if (error) throw error;
}

export async function loadNearbyOptIn(userId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('privacy_settings')
    .select('nearby_opt_in')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return asObject(data).nearby_opt_in === true;
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function mapNotificationPreferences(value: unknown): NotificationPreferences {
  const row = firstRow(value);
  const mode = row.deliveryMode;
  return {
    messagesEnabled: row.messagesEnabled !== false,
    datingEnabled: row.datingEnabled !== false,
    productEnabled: row.productEnabled === true,
    quietHoursEnabled: row.quietHoursEnabled === true,
    quietStart: typeof row.quietStart === 'string' && timePattern.test(row.quietStart) ? row.quietStart : '22:00',
    quietEnd: typeof row.quietEnd === 'string' && timePattern.test(row.quietEnd) ? row.quietEnd : '08:00',
    timezone: str(row.timezone, 'UTC') || 'UTC',
    deliveryMode: (mode === 'hourly' || mode === 'daily' ? mode : 'instant') as NotificationDeliveryMode,
    updatedAt: nullableStr(row.updatedAt),
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

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await requireSupabase().rpc('get_my_notification_preferences_v1');
  if (error) throw error;
  return mapNotificationPreferences(data);
}

/** Same RPC and payload as mobile updateMyNotificationPreferences(). */
export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
  const { data, error } = await requireSupabase().rpc('update_my_notification_preferences_v1', {
    p_messages_enabled: preferences.messagesEnabled,
    p_dating_enabled: preferences.datingEnabled,
    p_product_enabled: preferences.productEnabled,
    p_quiet_hours_enabled: preferences.quietHoursEnabled,
    p_quiet_start: timePattern.test(preferences.quietStart) ? preferences.quietStart : '22:00',
    p_quiet_end: timePattern.test(preferences.quietEnd) ? preferences.quietEnd : '08:00',
    p_timezone: preferences.timezone || detectedTimezone(),
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
  const appealRow = asObject(row.appeal);
  return {
    id: str(row.id),
    kind,
    reason: str(row.reason),
    startsAt: str(row.startsAt),
    expiresAt: nullableStr(row.expiresAt),
    appeal: str(appealRow.id)
      ? {
          id: str(appealRow.id),
          status: appealStatuses.find((candidate) => candidate === appealRow.status) ?? 'pending',
          createdAt: str(appealRow.createdAt),
        }
      : null,
  };
}

/** get_my_safety_center_v1 — own account status, sanctions and reports. */
export async function loadSafetyCenter(): Promise<SafetyCenter> {
  const { data, error } = await requireSupabase().rpc('get_my_safety_center_v1');
  if (error) throw error;
  const root = asObject(data);
  const reports = Array.isArray(root.recentReports) ? root.recentReports : [];
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
    hasMoreReports: root.hasMoreReports === true,
  };
}

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
 * Account deletion through the protected `delete-my-account` Edge Function —
 * the same server flow as mobile deleteAccount(): it verifies the caller's
 * JWT, removes private media, runs the deletion RPCs and finalises the auth
 * user server-side. The browser never holds a service_role key.
 */
export async function deleteAccount(): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('delete-my-account', {
    body: { confirmation: 'delete-my-account' },
  });
  if (error) throw error;
  if (asObject(data).deleted !== true) throw new Error('Account deletion failed.');
  // The caller signs out locally afterwards (AuthProvider.signOut) so the UI
  // can first navigate to the confirmation screen.
}
