import { useAccountData } from '../../account/AccountDataProvider';
import { planDescription, planLabel } from '../../account/labels';
import type { StoreSubscription } from '../../account/types';
import { AsyncState } from '../../components/AsyncState';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../lib/format';

function sourceText(subscription: StoreSubscription): string | null {
  if (!subscription.active) return null;
  if (subscription.tier === 'founder') return 'Статус раннего участника.';
  if (subscription.source === 'store') {
    const store =
      subscription.storePlatform === 'apple' ? 'App Store' : subscription.storePlatform === 'google' ? 'Google Play' : 'магазин приложений';
    return `Подписка оформлена через ${store}. Продлением и отменой управляют настройки подписок ${store}.`;
  }
  if (subscription.source === 'admin') return 'Доступ предоставлен командой Écoute Moi.';
  return null;
}

export function SubscriptionPage() {
  const { subscription } = useAccountData();
  return (
    <>
      <PageHeader eyebrow="Подписка" title="Premium / Exclusive">
        <p>Текущий статус вашего аккаунта. Оплата на сайте не принимается.</p>
      </PageHeader>
      <AsyncState
        loading={subscription.loading}
        error={subscription.error}
        data={subscription.data}
        onRetry={subscription.reload}
        loadingLabel="Загружаем статус подписки…"
      >
        {(data) => {
          const label = planLabel(data.tier, data.active);
          const source = sourceText(data);
          return (
            <section className={`panel plan-panel ${data.active ? 'plan-panel-active' : ''}`} aria-labelledby="plan-title">
              <p className="eyebrow">Ваш план</p>
              <h2 id="plan-title" className="plan-name">{label}</h2>
              <p className="panel-text">{planDescription(data.tier, data.active)}</p>
              {data.active && data.premiumUntil ? (
                <p className="panel-text">Действует до {formatDate(data.premiumUntil)}.</p>
              ) : null}
              {source ? <p className="panel-text">{source}</p> : null}
            </section>
          );
        }}
      </AsyncState>
      <section className="panel panel-muted" aria-labelledby="where-title">
        <h2 id="where-title" className="panel-title">Где оформить</h2>
        <p className="panel-text">
          Оформление подписки доступно только в приложении Écoute Moi для iOS и Android. Безопасность и базовая
          приватность доступны без подписки.
        </p>
      </section>
    </>
  );
}
