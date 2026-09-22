import { requireSupabase } from '../lib/supabase';
import type { BillingOffer, BillingStatus, CheckoutStart, PremiumTier } from './types';

/**
 * Billing for the web account app.
 *
 * The browser never sees a price it can change, a provider secret, or another
 * account's data:
 *   - offers come from list_billing_offers_v1(); the amount is the server's;
 *   - a checkout is started by the billing-create-checkout Edge Function,
 *     which takes the user from the access token and the price from the
 *     database. The only thing sent from here is an offer id;
 *   - the result of a payment is read from get_my_billing_status_v1(), never
 *     inferred from the page the provider redirects back to.
 *
 * Every object used here is listed in docs/WEB_BACKEND_MATRIX.md.
 */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const firstRow = (value: unknown): Json => asObject(Array.isArray(value) ? value[0] : value);
const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const nullableStr = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const tiers: PremiumTier[] = ['free', 'premium', 'exclusive', 'founder'];

/**
 * True when the backend simply does not have this function yet. The billing
 * migration is not in mobile `main` at the time of writing (see
 * docs/WEB_BACKEND_MATRIX.md), so the page degrades to the entitlement
 * contract that every deployed project already has, instead of erroring.
 */
function isMissingFunction(error: unknown, name: string): boolean {
  const record = asObject(error);
  const message = (error instanceof Error ? error.message : str(record.message)).toLowerCase();
  const code = str(record.code).toLowerCase();
  return (code === 'pgrst202'
    || message.includes('could not find the function')
    || message.includes('schema cache'))
    && message.includes(name);
}
const providers: BillingStatus['manageProvider'][] = ['yookassa', 'apple', 'google', 'rustore'];

/** Maps billing failures to neutral Russian text; no raw server message is shown. */
export function billingErrorMessage(error: unknown): string {
  const record = asObject(error);
  const message = (error instanceof Error ? error.message : str(record.message)).toLowerCase();
  const code = str(record.code).toLowerCase();
  if (/failed to fetch|network|load failed|offline/.test(message)) {
    return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.';
  }
  if (message.includes('subscription_conflict')) {
    return 'На аккаунте уже есть подписка с автопродлением. Сначала отключите её.';
  }
  if (message.includes('offer_unavailable') || message.includes('offer_required')) {
    return 'Этот тариф сейчас недоступен. Обновите страницу.';
  }
  if (message.includes('server_not_configured')) {
    return 'Оплата на сайте пока не включена. Попробуйте позже.';
  }
  if (message.includes('provider_rejected') || message.includes('provider_unavailable')) {
    return 'Платёжный сервис временно недоступен. Попробуйте позже.';
  }
  if (code === 'pgrst202' || /does not exist|schema cache|could not find the function/.test(message)) {
    return 'Оплата на сайте ещё не включена на сервере Écoute Moi.';
  }
  if (code === '28000' || code === 'pgrst301' || /jwt|not authenticated|нужна авторизация/.test(message)) {
    return 'Сессия истекла. Войдите снова.';
  }
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

/**
 * Effective status of the signed-in account. It says nothing about how the
 * subscription was paid for beyond which management flow applies.
 */
export async function loadBillingStatus(): Promise<BillingStatus> {
  const { data, error } = await requireSupabase().rpc('get_my_billing_status_v1');
  if (error) {
    if (!isMissingFunction(error, 'get_my_billing_status_v1')) throw error;
    return loadStatusFromEntitlement();
  }
  const row = firstRow(data);
  const tier = tiers.find((candidate) => candidate === row.tier) ?? 'free';
  const active = row.active === true && tier !== 'free';
  const provider = providers.find((candidate) => candidate === row.manage_provider) ?? null;
  return {
    tier: active ? tier : 'free',
    active,
    expiresAt: nullableStr(row.expires_at),
    unlimited: row.unlimited === true,
    autoRenew: row.auto_renew === true,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    manageProvider: provider,
    paymentPending: row.payment_pending === true,
  };
}

/**
 * Status from get_my_entitlement(), the contract that exists in every
 * deployed project. It knows the level and the end date but nothing about
 * autopayment, so no management action is offered.
 */
async function loadStatusFromEntitlement(): Promise<BillingStatus> {
  const { data, error } = await requireSupabase().rpc('get_my_entitlement');
  if (error) throw error;
  const row = firstRow(data);
  const tier = tiers.find((candidate) => candidate === row.tier) ?? 'free';
  const active = row.is_premium === true && tier !== 'free';
  return {
    tier: active ? tier : 'free',
    active,
    expiresAt: nullableStr(row.premium_until),
    unlimited: active && tier === 'founder',
    autoRenew: false,
    cancelAtPeriodEnd: false,
    manageProvider: null,
    paymentPending: false,
  };
}

/**
 * The tariffs this deployment actually sells, with server-set prices. An
 * empty list - including a backend without the billing migration - means the
 * page shows that payment on the site is not open yet.
 */
export async function loadBillingOffers(): Promise<BillingOffer[]> {
  const { data, error } = await requireSupabase().rpc('list_billing_offers_v1');
  if (error) {
    if (isMissingFunction(error, 'list_billing_offers_v1')) return [];
    throw error;
  }
  return (Array.isArray(data) ? data : [])
    .map((item) => {
      const row = asObject(item);
      const tier = row.tier === 'exclusive' ? 'exclusive' : 'premium';
      return {
        id: str(row.id),
        tier,
        title: str(row.title, 'Подписка'),
        description: nullableStr(row.description),
        priceAmount: num(row.price_amount),
        currency: str(row.currency, 'RUB'),
        durationDays: num(row.duration_days),
        recurringAllowed: row.recurring_allowed === true,
      } satisfies BillingOffer;
    })
    .filter((offer) => offer.id && offer.priceAmount > 0);
}

/**
 * Starts a payment. The Edge Function runs as the signed-in user - the access
 * token is the only identity it accepts - and answers with the provider's
 * confirmation page.
 */
export async function startCheckout(offerId: string, savePaymentMethod: boolean): Promise<CheckoutStart> {
  const { data, error } = await requireSupabase().functions.invoke('billing-create-checkout', {
    body: {
      offer_id: offerId,
      save_payment_method: savePaymentMethod,
      return_url: `${window.location.origin}/account/subscription/payment`,
    },
  });
  if (error) {
    // supabase-js hides the response body of a non-2xx answer behind a
    // generic message, so the server's error code is read from it directly.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      const body = await context.json().catch(() => ({}));
      const code = str(asObject(body).error);
      if (code) throw new Error(code);
    }
    throw error;
  }
  const row = asObject(data);
  const confirmationUrl = str(row.confirmation_url);
  if (!confirmationUrl) throw new Error('provider_rejected');
  return {
    paymentId: str(row.payment_id),
    confirmationUrl,
    notice: nullableStr(row.notice),
  };
}

/** Turns off autopayment. The already-paid period is kept to its end. */
export async function cancelAutoRenew(): Promise<string | null> {
  const { data, error } = await requireSupabase().rpc('cancel_my_web_subscription_v1');
  if (error) throw error;
  return nullableStr(firstRow(data).current_period_end);
}

export function tierLabel(tier: PremiumTier): string {
  if (tier === 'founder') return 'Основатель';
  if (tier === 'exclusive') return 'Exclusive';
  if (tier === 'premium') return 'Premium';
  return 'Обычный доступ';
}

export function formatPrice(offer: BillingOffer): string {
  const amount = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: offer.currency,
    maximumFractionDigits: offer.priceAmount % 1 === 0 ? 0 : 2,
  }).format(offer.priceAmount);
  return amount;
}

export function durationLabel(days: number): string {
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? '1 год' : `${years} года`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    if (months === 1) return '1 месяц';
    return months < 5 ? `${months} месяца` : `${months} месяцев`;
  }
  return `${days} дн.`;
}

/** Where a person manages a subscription that is not managed on this site. */
export function appleSubscriptionsUrl(): string {
  return 'https://apps.apple.com/account/subscriptions';
}
