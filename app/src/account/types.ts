export type PremiumTier = 'free' | 'premium' | 'exclusive' | 'founder';

/** Payment source of a subscription. Never shown to the user as such. */
export type BillingProvider = 'yookassa' | 'apple' | 'google' | 'rustore';

/**
 * Row of public.get_my_billing_status_v1() (ecoutemoi-mobile main,
 * supabase/migrations/20260921_billing_web_subscriptions.sql). The effective
 * level of the account computed from every payment source at once, plus what
 * this page needs to offer the right management action.
 */
export type BillingStatus = {
  tier: PremiumTier;
  active: boolean;
  expiresAt: string | null;
  /** Permanent access (founder): no end date. */
  unlimited: boolean;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  manageProvider: BillingProvider | null;
  /** A payment exists but the provider has not confirmed it yet. */
  paymentPending: boolean;
};

/**
 * Row of public.list_billing_offers_v1(). The price is the server's, always:
 * the browser only ever sends an offer id back.
 */
export type BillingOffer = {
  id: string;
  tier: Exclude<PremiumTier, 'free' | 'founder'>;
  title: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  durationDays: number;
  recurringAllowed: boolean;
};

/** Answer of the billing-create-checkout Edge Function. */
export type CheckoutStart = {
  paymentId: string;
  confirmationUrl: string;
  /** 'already_active' when the account is already covered at this level. */
  notice: string | null;
};

/** What the payment page may show after the provider sends a person back. */
export type PaymentState = 'processing' | 'success' | 'failed' | 'canceled';

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
