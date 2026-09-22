/**
 * Display labels for codes returned by the backend. The dating labels repeat
 * the option labels of ecoutemoi-mobile main (src/services/dating.ts and
 * src/content/geography.ts) so both clients describe the same data with the
 * same words. Unknown codes fall back to a neutral value.
 */
import type { AccountRestriction, Entitlement } from './types';

const gender: Record<string, string> = {
  woman: 'Женщина',
  man: 'Мужчина',
};

const lookingFor: Record<string, string> = { woman: 'Женщин', man: 'Мужчин', any: 'Пол не важен' };

const goals: Record<string, string> = {
  serious: 'Серьёзные отношения',
  relationship: 'Романтическое знакомство',
  friendship: 'Дружба и общение',
  business: 'Деловое знакомство',
  open: 'Пока не определился',
};

const children: Record<string, string> = {
  have: 'Есть дети',
  want: 'Хочу детей',
  dont_want: 'Не планирую',
  open: 'Открыт(а) к разговору',
  prefer_not_to_say: 'Не указывать',
};

const smoking: Record<string, string> = {
  never: 'Не курю',
  occasionally: 'Иногда',
  regularly: 'Регулярно',
  prefer_not_to_say: 'Не указывать',
};

const alcohol: Record<string, string> = {
  never: 'Не употребляю',
  occasionally: 'Иногда',
  regularly: 'Регулярно',
  prefer_not_to_say: 'Не указывать',
};

const pace: Record<string, string> = {
  slow: 'Спокойный',
  balanced: 'Сбалансированный',
  active: 'Активный',
  prefer_not_to_say: 'Не указывать',
};

const zodiac: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец', capricorn: 'Козерог',
  aquarius: 'Водолей', pisces: 'Рыбы',
};

const prompts: Record<string, string> = {
  good_day: 'Что вас вдохновляет?',
  want_to_hear: 'Какие отношения вы ищете?',
  free_story: 'Как выглядит ваш идеальный вечер?',
  why_here: 'Почему вы здесь?',
  talk_for_hours: 'О чём вы можете говорить часами?',
  without_labels: 'Расскажите о себе без профессии и внешности.',
};

const countries: Record<string, string> = {
  RU: 'Россия', BY: 'Беларусь', KZ: 'Казахстан', AM: 'Армения', GE: 'Грузия', AZ: 'Азербайджан',
  KG: 'Кыргызстан', UZ: 'Узбекистан', TR: 'Турция', DE: 'Германия', FR: 'Франция', ES: 'Испания',
  IT: 'Италия', GB: 'Великобритания', US: 'США', CA: 'Канада', AE: 'ОАЭ', IL: 'Израиль',
  PL: 'Польша', CZ: 'Чехия', NL: 'Нидерланды', PT: 'Португалия', RS: 'Сербия', ME: 'Черногория',
  TH: 'Таиланд',
};

const pick = (map: Record<string, string>, value: string | null | undefined) =>
  value ? map[value] ?? null : null;

export const labels = {
  gender: (value: string | null) => pick(gender, value),
  lookingFor: (values: string[]) => values.map((value) => lookingFor[value] ?? value),
  goal: (value: string | null) => pick(goals, value),
  children: (value: string | null) => pick(children, value),
  smoking: (value: string | null) => pick(smoking, value),
  alcohol: (value: string | null) => pick(alcohol, value),
  pace: (value: string | null) => pick(pace, value),
  zodiac: (value: string | null) => pick(zodiac, value),
  prompt: (value: string | null) => (value ? prompts[value] ?? 'Аудиописьмо' : null),
  country: (value: string | null) => pick(countries, value),
  language: (value: string) => (value === 'ru' ? 'Русский' : value === 'en' ? 'English' : value.toUpperCase()),
};

/**
 * Tier names as the backend reports them (get_my_entitlement.tier). The tier
 * is the effective level of the account across every payment source, so the
 * same words describe a purchase made in the app and one made on the site.
 */
export function entitlementLabel(entitlement: Entitlement): 'Free' | 'Premium' | 'Exclusive' | 'Founder' {
  if (!entitlement.active) return 'Free';
  if (entitlement.tier === 'founder') return 'Founder';
  return entitlement.tier === 'exclusive' ? 'Exclusive' : 'Premium';
}

/** Wording of mobile main adminAccountStatusLabel(): suspended → «Приостановлен», banned → «Заблокирован». */
export const restrictionLabels: Record<AccountRestriction['kind'], string> = {
  suspended: 'Аккаунт приостановлен',
  banned: 'Аккаунт заблокирован',
};
