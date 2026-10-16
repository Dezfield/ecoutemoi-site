import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { getAudioLettersEnabled } from '../../product/api';

/**
 * Accounts moved to audio letters must not keep using the previous
 * like/mutual-response discovery on the web: the app and the web would then follow
 * different rules. Until the web has the new flow, those accounts see an honest
 * pointer to the iPhone app; chats opened after mutual disclosure stay here.
 */
export function AudioLettersGate({ title, children }: { title: string; children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'legacy' | 'audio_letters' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    getAudioLettersEnabled()
      .then((enabled) => { if (active) setState(enabled ? 'audio_letters' : 'legacy'); })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);

  if (state === 'legacy') return <>{children}</>;
  return (
    <section className="product-page">
      <PageHeader eyebrow="Знакомства" title={title} />
      {state === 'loading' ? <p role="status">Проверяем формат знакомств…</p> : null}
      {state === 'error' ? (
        <Notice tone="error" title="Не удалось загрузить раздел">Проверьте соединение и обновите страницу.</Notice>
      ) : null}
      {state === 'audio_letters' ? (
        <Notice tone="info" title="Знакомства теперь начинаются с аудиописьма">
          <p>Для вашего аккаунта включён новый формат: аудиописьма, ответ голосом и взаимное решение открыться друг другу. Пока он доступен в приложении Écoute Moi для iPhone.</p>
          <p>Разговоры с теми, с кем вы уже открылись друг другу, доступны здесь — в разделе <Link to="/chats">«Чаты»</Link>.</p>
        </Notice>
      ) : null}
    </section>
  );
}
