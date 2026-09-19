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

/**
 * Row of public.get_my_account_restriction() (ecoutemoi-mobile main,
 * supabase/migrations/20260810_trust_safety_push.sql): the caller's own active
 * suspension or ban. The RPC does not return the sanction id.
 */
export type AccountRestriction = {
  kind: 'suspended' | 'banned';
  reason: string;
  expiresAt: string | null;
};

export type BlockedUser = { id: string; name: string; blockedAt: string };
