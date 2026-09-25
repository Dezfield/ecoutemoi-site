export type PremiumTier = 'free' | 'premium' | 'founder';

export type DatingProfile = {
  displayName: string;
  about: string;
  birthDate: string | null;
  city: string | null;
  countryCode: string | null;
  genderCode: string | null;
  lookingFor: string[];
  relationshipGoal: string | null;
  interests: string[];
  languages: string[];
  profileValues: string[];
  childrenPreference: string | null;
  smokingCode: string | null;
  alcoholCode: string | null;
  communicationPace: string | null;
  whatMatters: string;
  zodiacSign: string | null;
  preferredMinAge: number | null;
  preferredMaxAge: number | null;
  audioPromptKey: string | null;
  audioPath: string | null;
  audioDurationSeconds: number | null;
  photoPaths: string[];
  onboardingComplete: boolean;
  discoveryEnabled: boolean;
};

export type AccountSummary = {
  userId: string;
  email: string | null;
  displayName: string;
  createdAt: string | null;
  dating: DatingProfile | null;
  /** Short-lived signed URL of the first profile photo (own media only). */
  photoUrl: string | null;
};

/**
 * Row of public.get_my_entitlement() (ecoutemoi-mobile main,
 * supabase/migrations/20260820_chat_product_premium.sql). The RPC reports only
 * the tier, whether it is active and the premium end date — nothing about how
 * the status was obtained.
 */
export type Entitlement = {
  tier: PremiumTier;
  active: boolean;
  /** End of a `premium` tier; null for founder and free without history. */
  premiumUntil: string | null;
};

/** Row of get_my_active_sessions(): the caller's own auth sessions. */
export type AccountSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
};

export type NotificationDeliveryMode = 'instant' | 'hourly' | 'daily';

/** jsonb of get_/update_my_notification_preferences_v1 (field names as returned). */
export type NotificationPreferences = {
  messagesEnabled: boolean;
  datingEnabled: boolean;
  productEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
  deliveryMode: NotificationDeliveryMode;
};

/** Value sets of the CHECK constraints in mobile main (user_sanctions, moderation_appeals, user_reports). */
export type SanctionKind = 'warning' | 'suspended' | 'banned';
export type AppealStatus = 'pending' | 'reviewing' | 'upheld' | 'overturned';
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

export type SafetySanction = {
  /** Server-issued id from get_my_safety_center_v1; used only for submit_moderation_appeal. */
  id: string;
  kind: SanctionKind;
  reason: string;
  startsAt: string;
  expiresAt: string | null;
  appeal: { id: string; status: AppealStatus; createdAt: string } | null;
};

export type SafetyCenter = {
  activeSanction: SafetySanction | null;
  recentReports: Array<{ id: string; category: string; status: ReportStatus; createdAt: string }>;
  recentAppeals: Array<{ id: string; status: AppealStatus; sanctionKind: SanctionKind | null; createdAt: string }>;
  hasMoreReports: boolean;
};

export type BlockedUser = { id: string; name: string; blockedAt: string };
