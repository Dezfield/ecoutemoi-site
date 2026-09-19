import { PageHeader } from '../../components/PageHeader';

/**
 * Informational only. ecoutemoi-mobile main has no notification-preferences
 * backend: the app enables push notifications per device (the «Уведомления»
 * card with «Включить уведомления» in src/features/dating/DatingExperience.tsx),
 * and its privacy text says they are turned off in the device settings. The
 * web therefore shows no switches and saves nothing.
 */
export function NotificationsPage() {
  return (
    <>
      <PageHeader eyebrow="Мой аккаунт" title="Уведомления">
        <p>Настройки уведомлений сейчас доступны в мобильном приложении Écoute Moi.</p>
      </PageHeader>
      <section className="panel" aria-labelledby="push-title">
        <h2 id="push-title" className="panel-title">Push-уведомления</h2>
        <p className="panel-text">
          Уведомления включаются в приложении Écoute Moi на вашем телефоне. Отключить их можно в настройках телефона.
        </p>
        <p className="panel-text">
          Приложение сообщает о новых сообщениях, Резонансе и Взаимности. Сайт уведомления не отправляет.
        </p>
      </section>
    </>
  );
}
