import { Link } from 'react-router';

import { useAccountData } from '../../account/AccountDataProvider';
import { labels, planLabel } from '../../account/labels';
import { useAuth } from '../../auth/AuthProvider';
import { Icon, type IconName } from '../../components/Icon';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { Spinner } from '../../components/Spinner';
import { ageFromBirthDate, initials, yearsLabel } from '../../lib/format';

const shortcuts: Array<{ to: string; icon: IconName; title: string; text: string }> = [
  { to: '/account/profile', icon: 'profile', title: 'Профиль', text: 'Анкета, аудиописьмо и фотографии' },
  { to: '/account/settings', icon: 'key', title: 'Аккаунт и вход', text: 'Почта, способы входа, копия данных' },
  { to: '/account/notifications', icon: 'bell', title: 'Уведомления', text: 'Категории, тихие часы и сводки' },
  { to: '/account/security', icon: 'shield', title: 'Безопасность', text: 'Статус аккаунта и активные сессии' },
  { to: '/account/privacy', icon: 'lock', title: 'Конфиденциальность', text: 'Что и когда видят другие' },
  { to: '/account/subscription', icon: 'star', title: 'Premium / Exclusive', text: 'Текущий статус подписки' },
];

export function OverviewPage() {
  const { user, status } = useAuth();
  const { summary, subscription } = useAccountData();
  const data = summary.data;
  const age = ageFromBirthDate(data?.dating?.birthDate);
  const city = data?.dating?.city;
  const country = labels.country(data?.dating?.countryCode ?? null);

  return (
    <>
      <PageHeader eyebrow="Личный кабинет" title="Обзор" />

      <section className="panel profile-hero" aria-label="Ваш аккаунт">
        {summary.loading && !data ? (
          <Spinner label="Загружаем профиль…" />
        ) : summary.error && !data ? (
          <Notice
            tone="error"
            title="Не удалось загрузить профиль"
            action={<button type="button" className="button button-secondary button-small" onClick={summary.reload}>Повторить</button>}
          >
            <p>{summary.error}</p>
          </Notice>
        ) : (
          <>
            <span className="avatar avatar-large" aria-hidden="true">
              {data?.photoUrl ? <img src={data.photoUrl} alt="" /> : <span>{initials(data?.displayName ?? user?.email)}</span>}
            </span>
            <div className="profile-hero-copy">
              <p className="profile-hero-name">
                {data?.displayName ?? 'Ваш аккаунт'}
                {age !== null ? <span className="profile-hero-age">, {yearsLabel(age)}</span> : null}
              </p>
              {city ? <p className="profile-hero-meta">{[city, country].filter(Boolean).join(', ')}</p> : null}
              <p className="profile-hero-meta">{user?.email ?? 'Email не указан'}</p>
              <div className="chips">
                {subscription.data ? (
                  <span className="chip chip-accent">{planLabel(subscription.data.tier, subscription.data.active)}</span>
                ) : null}
                <span className="chip">
                  {status === 'authenticated_profile_ready' ? 'Анкета заполнена' : 'Анкета не завершена'}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="shortcuts-title">
        <h2 id="shortcuts-title" className="section-title">Мой аккаунт</h2>
        <ul className="shortcut-grid">
          {shortcuts.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="shortcut">
                <span className="shortcut-icon"><Icon name={item.icon} /></span>
                <span className="shortcut-title">{item.title}</span>
                <span className="shortcut-text">{item.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel panel-muted" aria-labelledby="app-only-title">
        <h2 id="app-only-title" className="panel-title">Голоса, Резонансы и чаты — в приложении</h2>
        <p>
          Аудиописьма, Отклики, Резонансы, Взаимность и переписка пока доступны в мобильном приложении Écoute Moi.
          Здесь — управление аккаунтом, уведомлениями и безопасностью.
        </p>
      </section>
    </>
  );
}
