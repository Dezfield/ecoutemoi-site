import { accountErrorMessage, loadNearbyOptIn } from '../../account/api';
import { useAuth } from '../../auth/AuthProvider';
import { AsyncState } from '../../components/AsyncState';
import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';
import { useAsync } from '../../lib/useAsync';

export function PrivacyPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const nearby = useAsync(() => loadNearbyOptIn(userId), accountErrorMessage, [userId]);

  return (
    <>
      <PageHeader eyebrow="Мой аккаунт" title="Конфиденциальность">
        <p>Настройки видимости вашего профиля. Юридический документ — в разделе «Документы».</p>
      </PageHeader>

      <section className="panel" aria-labelledby="by-design-title">
        <h2 id="by-design-title" className="panel-title">Приватность по замыслу</h2>
        <p className="panel-text">
          Имя и фотографии скрыты до взаимного Отклика. Для подбора используется город, но не точные координаты.
          Содержимое личных чатов не анализируется для совместимости.
        </p>
      </section>

      <section className="panel" aria-labelledby="nearby-title">
        <h2 id="nearby-title" className="panel-title">Мягкий статус «рядом»</h2>
        <AsyncState loading={nearby.loading} error={nearby.error} data={nearby.data} onRetry={nearby.reload}>
          {(enabled) => (
            <>
              <p className="panel-text">
                <span className={`status-pill ${enabled ? 'status-ok' : ''}`}>{enabled ? 'Включён' : 'Выключен'}</span>
              </p>
              <p className="panel-text">
                Показывается только при взаимном согласии и совпадении города. Точные координаты не передаются.
              </p>
            </>
          )}
        </AsyncState>
        <p className="panel-note">Статус относится к возможностям Premium и меняется в приложении.</p>
      </section>

      <section className="panel" aria-labelledby="policy-title">
        <h2 id="policy-title" className="panel-title">Политика конфиденциальности</h2>
        <p className="panel-text">Как Écoute Moi обрабатывает данные — в опубликованном документе.</p>
        <a className="button button-secondary" href={config.links.privacy}>Открыть политику конфиденциальности</a>
      </section>
    </>
  );
}
