/** Formatting helpers shared by the account screens. Pure and locale-stable. */

const LOCALE = 'ru-RU';

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(LOCALE, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/**
 * Full years between an ISO `YYYY-MM-DD` birth date and `now`. Returns null
 * for missing or malformed input instead of guessing.
 */
export function ageFromBirthDate(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

/** Russian plural form for "год": 21 год, 22 года, 25 лет. */
export function yearsLabel(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod10 === 1 && mod100 !== 11) return `${age} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${age} года`;
  return `${age} лет`;
}

export function initials(name: string | null | undefined): string {
  return (
    (name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'É'
  );
}

/** Mirrors the mobile Account Center device label. */
export function sessionDeviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Неизвестное устройство';
  if (/iphone|ipad/i.test(userAgent)) return 'iPhone или iPad';
  if (/android/i.test(userAgent)) return 'Android';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os/i.test(userAgent)) return 'Mac';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Браузер или приложение';
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}
