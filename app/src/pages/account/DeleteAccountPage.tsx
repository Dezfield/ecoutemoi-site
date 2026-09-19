import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';

/**
 * Safe fallback. ecoutemoi-mobile main contains no user-facing account
 * deletion backend (no `delete-my-account` Edge Function or equivalent RPC;
 * begin_delete_my_dating_profile / delete_my_dating_profile only reset the
 * dating profile and keep the auth account). Until a reviewed deletion
 * backend exists, the web performs no deletion request of any kind.
 */
export function DeleteAccountPage() {
  return (
    <>
      <PageHeader eyebrow="Аккаунт" title="Удаление аккаунта">
        <p>Удаление аккаунта через сайт пока недоступно.</p>
      </PageHeader>

      <section className="panel" aria-labelledby="delete-how-title">
        <h2 id="delete-how-title" className="panel-title">Как удалить аккаунт</h2>
        <p className="panel-text">
          Сайт не удаляет аккаунт и данные. Порядок удаления описан на странице «Удаление аккаунта» на сайте Écoute
          Moi.
        </p>
        <div className="button-row">
          <a className="button button-secondary" href={config.links.accountDeletion}>Открыть страницу «Удаление аккаунта»</a>
        </div>
        <p className="panel-note">Выход из аккаунта на этом сайте не удаляет профиль и данные.</p>
      </section>
    </>
  );
}
