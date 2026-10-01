import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';

export function SupportPage() {
  return (
    <>
      <PageHeader eyebrow="Безопасность" title="Поддержка">
        <p>Напишите на <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> или обратитесь через приложение Écoute Moi.</p>
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
        <p className="panel-text">Если вход недоступен, напишите на <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>. Укажите адрес, с которым входили в аккаунт, но не отправляйте пароль или код входа.</p>
        <div className="button-row">
          <a className="button button-secondary" href={config.links.support}>Страница поддержки</a>
          <a className="button button-secondary" href={`mailto:${config.supportEmail}`}>Написать на почту</a>
          <a className="button button-ghost" href={config.links.community}>Правила сообщества</a>
        </div>
      </section>
    </>
  );
}
