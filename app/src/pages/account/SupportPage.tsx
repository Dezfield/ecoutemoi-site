import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';

export function SupportPage() {
  return (
    <>
      <PageHeader eyebrow="Безопасность" title="Поддержка">
        <p>Поддержка доступна через приложение Écoute Moi.</p>
      </PageHeader>
      <section className="panel" aria-labelledby="in-app-title">
        <h2 id="in-app-title" className="panel-title">Обращение в поддержку</h2>
        <p className="panel-text">
          Откройте профиль в приложении, затем раздел безопасности и поддержки в центре управления аккаунтом. Выберите
          обращение в поддержку.
        </p>
      </section>
      <section className="panel" aria-labelledby="report-title">
        <h2 id="report-title" className="panel-title">Жалоба на пользователя</h2>
        <p className="panel-text">
          Используйте раздел безопасности конкретного разговора. На аудиописьмо можно пожаловаться ещё до открытия
          чата.
        </p>
      </section>
      <section className="panel panel-muted" aria-labelledby="more-title">
        <h2 id="more-title" className="panel-title">Если нет доступа к аккаунту</h2>
        <p className="panel-text">Актуальная информация о каналах связи публикуется на странице поддержки.</p>
        <div className="button-row">
          <a className="button button-secondary" href={config.links.support}>Страница поддержки</a>
          <a className="button button-ghost" href={config.links.community}>Правила сообщества</a>
        </div>
      </section>
    </>
  );
}
