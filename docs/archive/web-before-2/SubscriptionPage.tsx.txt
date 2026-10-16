import { useAccountData } from '../../account/AccountDataProvider';
import { entitlementLabel } from '../../account/labels';
import type { Entitlement } from '../../account/types';
import { AsyncState } from '../../components/AsyncState';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../lib/format';

/**
 * Only facts returned by get_my_entitlement(): tier, active state, premium end
 * date. formatDate() already ends with «г.», so no period is appended to it.
 */
function statusText(entitlement: Entitlement): string {
  if (entitlement.active && entitlement.tier === 'founder') return 'Бессрочный статус.';
  if (entitlement.active) {
    return entitlement.premiumUntil ? `Действует до ${formatDate(entitlement.premiumUntil)}` : 'Premium активен.';
  }
  return entitlement.premiumUntil
    ? `Premium не активен. Срок действия закончился ${formatDate(entitlement.premiumUntil)}`
    : 'Premium не активен.';
}

export function SubscriptionPage() {
  const { entitlement } = useAccountData();
  return (
    <>
      <PageHeader eyebrow="Подписка" title="Premium">
        <p>Текущий статус Premium вашего аккаунта. Оплата на сайте не принимается.</p>
      </PageHeader>
      <AsyncState
        loading={entitlement.loading}
        error={entitlement.error}
        data={entitlement.data}
        onRetry={entitlement.reload}
        loadingLabel="Загружаем статус…"
      >
        {(data) => (
          <section className={`panel plan-panel ${data.active ? 'plan-panel-active' : ''}`} aria-labelledby="plan-title">
            <p className="eyebrow">Ваш статус</p>
            <h2 id="plan-title" className="plan-name">{entitlementLabel(data)}</h2>
            <p className="panel-text">{statusText(data)}</p>
          </section>
        )}
      </AsyncState>
    </>
  );
}
