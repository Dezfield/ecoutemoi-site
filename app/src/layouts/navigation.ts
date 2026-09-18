import { config } from '../config';
import type { IconName } from '../components/Icon';

export type NavItem =
  | { kind: 'route'; to: string; label: string; icon: IconName; end?: boolean }
  | { kind: 'external'; href: string; label: string; icon: IconName };

export type NavGroup = { title: string | null; items: NavItem[] };

/**
 * Account navigation. Future product areas (Голоса, Отклики, Резонансы,
 * Чаты) are added here as new groups/routes without changing the shell.
 */
export const accountNavigation: NavGroup[] = [
  {
    title: null,
    items: [{ kind: 'route', to: '/account', label: 'Обзор', icon: 'home', end: true }],
  },
  {
    title: 'Мой аккаунт',
    items: [
      { kind: 'route', to: '/account/profile', label: 'Профиль', icon: 'profile' },
      { kind: 'route', to: '/account/settings', label: 'Аккаунт и вход', icon: 'key' },
      { kind: 'route', to: '/account/privacy', label: 'Конфиденциальность', icon: 'lock' },
      { kind: 'route', to: '/account/notifications', label: 'Уведомления', icon: 'bell' },
    ],
  },
  {
    title: 'Подписка',
    items: [{ kind: 'route', to: '/account/subscription', label: 'Premium / Exclusive', icon: 'star' }],
  },
  {
    title: 'Безопасность',
    items: [
      { kind: 'route', to: '/account/security', label: 'Безопасность', icon: 'shield' },
      { kind: 'route', to: '/account/blocked', label: 'Заблокированные', icon: 'block' },
      { kind: 'route', to: '/account/support', label: 'Поддержка', icon: 'help' },
    ],
  },
  {
    title: 'Информация',
    items: [
      { kind: 'external', href: config.links.howItWorks, label: 'Как работает Écoute Moi', icon: 'info' },
      { kind: 'external', href: config.links.faq, label: 'Частые вопросы', icon: 'help' },
      { kind: 'route', to: '/account/legal', label: 'Документы', icon: 'doc' },
    ],
  },
];
