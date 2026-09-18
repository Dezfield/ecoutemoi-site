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

export type StoreSubscription = {
  tier: PremiumTier;
  active: boolean;
  premiumUntil: string | null;
  source: 'admin' | 'store' | 'none' | string;
  storePlatform: string | null;
};

export type BlockedUser = { id: string; name: string; blockedAt: string };

export type NotificationDeliveryMode = 'instant' | 'hourly' | 'daily';

export type NotificationPreferences = {
  messagesEnabled: boolean;
  datingEnabled: boolean;
  productEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
  deliveryMode: NotificationDeliveryMode;
  updatedAt: string | null;
};

export type SanctionKind = 'warning' | 'suspended' | 'banned';
export type AppealStatus = 'pending' | 'reviewing' | 'upheld' | 'overturned';
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

export type SafetyAppeal = {
  id: string;
  status: AppealStatus;
  createdAt: string;
};

export type SafetySanction = {
  id: string;
  kind: SanctionKind;
  reason: string;
  startsAt: string;
  expiresAt: string | null;
  appeal: SafetyAppeal | null;
};

export type SafetyReport = {
  id: string;
  category: string;
  status: ReportStatus;
  createdAt: string;
};

export type SafetyCenter = {
  activeSanction: SafetySanction | null;
  recentReports: SafetyReport[];
  hasMoreReports: boolean;
};
