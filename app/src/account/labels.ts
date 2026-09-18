/**
 * Display labels ported from the mobile app (src/services/dating.ts,
 * src/content/geography.ts, features/safety/SafetyAccountPanel.tsx,
 * features/dating/honestPremium.ts) so both clients describe the same data
 * with the same words. Unknown codes fall back to a neutral value.
 */
import type { AppealStatus, PremiumTier, ReportStatus, SanctionKind } from './types';

const gender: Record<string, string> = {
  woman: 'Женщина',
  man: 'Мужчина',
  nonbinary: 'Небинарная идентичность',
  other: 'Другое',
  prefer_not_to_say: 'Не указано',
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

export const sanctionLabels: Record<SanctionKind, string> = {
  warning: 'Предупреждение',
  suspended: 'Временное ограничение',
  banned: 'Аккаунт заблокирован',
};

export const appealLabels: Record<AppealStatus, string> = {
  pending: 'Ожидает рассмотрения',
  reviewing: 'Рассматривается',
  upheld: 'Решение оставлено в силе',
  overturned: 'Ограничение отменено',
};

export const reportLabels: Record<ReportStatus, string> = {
  open: 'Получена',
  reviewing: 'На рассмотрении',
  actioned: 'Меры приняты',
  dismissed: 'Рассмотрена',
};

export const reportCategoryLabels: Record<string, string> = {
  spam: 'Спам или мошенничество',
  harassment: 'Оскорбления или преследование',
  impersonation: 'Выдаёт себя за другого',
  inappropriate: 'Неприемлемый контент',
  other: 'Другая причина',
};

/** honestPremium.publicPremiumPlan: founder → Exclusive, active premium → Premium. */
export function planLabel(tier: PremiumTier, active: boolean): 'Бесплатный' | 'Premium' | 'Exclusive' {
  if (!active) return 'Бесплатный';
  return tier === 'founder' ? 'Exclusive' : 'Premium';
}

/** honestPremium.publicPremiumPlanDescription — unchanged mobile copy. */
export function planDescription(tier: PremiumTier, active: boolean): string {
  const plan = planLabel(tier, active);
  if (plan === 'Exclusive') {
    return 'Статус раннего участника включает Premium. Новые возможности Exclusive появятся после запуска; они не влияют на место карточки в подборе.';
  }
  if (plan === 'Premium') {
    return 'Дополнительное удобство, приватность и контроль — без покупки взаимности или ранжирования.';
  }
  return 'Полное знакомство и безопасность доступны без подписки.';
}
