import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { VoiceComposer, VoicePlayer } from '../../components/VoiceClip';
import {
  archiveLetter,
  closeVoiceThread,
  disclose,
  disclosedProfiles,
  letterFeed,
  listened,
  markVoiceListened,
  myLetters,
  publishLetter,
  replyVoice,
  reportLetter,
  respondLetter,
  skipLetter,
  topics,
  voiceThread,
  voiceThreads,
  type DisclosedProfile,
  type Letter,
  type LettersState,
  type VoiceThread,
} from '../../product/audioLetters';
import { productError, signedMedia } from '../../product/api';
import { AudioPublicationConsent } from '../../legal/LegalScreens';

export function AudioLettersPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LettersState | null>(null);
  const [items, setItems] = useState<Letter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('free');
  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const own = await myLetters();
      setState(own);
      if (own.enabled) setItems((await letterFeed()).items);
      else setItems([]);
    } catch (cause) {
      setError(productError(cause));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (cause) {
      setError(productError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="product-page">
      <PageHeader eyebrow="Слушать. Слышать. Видеть." title="Аудиописьма">
        Сначала мысль и голос. Анкета и фотографии — после отдельного согласия каждого.
      </PageHeader>
      <button className="button button-secondary" disabled={busy} onClick={() => void load()}>
        Обновить
      </button>
      {error && (
        <p role="alert" className="product-error">
          {error}
        </p>
      )}
      {!state && busy && <p role="status">Загружаем аудиописьма…</p>}
      {state && !state.enabled && (
        <p className="product-empty">
          Аудиописьма пока не включены для вашего аккаунта. Существующие чаты и настройки доступны.
        </p>
      )}
      {state?.enabled && (
        <>
          <div className="letter-grid">
            {items.map((item) => (
              <article key={item.impression_id} className="product-card">
                <p className="eyebrow">{topics.find((t) => t[0] === item.topic_key)?.[1] ?? 'Аудиописьмо'}</p>
                <h2>{item.title || 'Мысль, которой хочется поделиться'}</h2>
                <p>
                  {[item.context.age ? `${item.context.age} лет` : null, item.context.city]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <VoicePlayer
                  path={item.storage_path}
                  onListened={async () => {
                    await listened(item.impression_id);
                    setHeard((old) => new Set([...old, item.impression_id]));
                  }}
                />
                <div className="button-row">
                  <button
                    className="button button-primary"
                    disabled={busy || !(item.listened || heard.has(item.impression_id))}
                    onClick={() =>
                      setResponding(responding === item.impression_id ? null : item.impression_id)
                    }
                  >
                    Откликнуться голосом
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => void action(() => skipLetter(item.impression_id))}
                  >
                    Пропустить
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Пожаловаться на аудиописьмо и заблокировать автора?'))
                        void action(() => reportLetter('impression', item.impression_id));
                    }}
                  >
                    Пожаловаться
                  </button>
                </div>
                {responding === item.impression_id && (
                  <VoiceComposer
                    min={state.limits.response_min_seconds}
                    max={state.limits.response_max_seconds}
                    purpose="note"
                    onSend={async (pending) => {
                      const result = await respondLetter(item.impression_id, pending);
                      navigate(`/responses/${result.thread_id}`);
                    }}
                  />
                )}
              </article>
            ))}
          </div>
          {!items.length && !busy && !error && (
            <p className="product-empty">Новых аудиописем пока нет. Вернитесь позже.</p>
          )}
          <section className="product-card">
            <h2>Мои аудиописьма</h2>
            <p>После публикации новое письмо проходит модерацию.</p>
            {state.letters.map((letter) => (
              <article className="own-letter" key={letter.id}>
                <h3>{letter.title || 'Аудиописьмо'}</h3>
                <p>
                  {letter.status === 'archived'
                    ? 'В архиве'
                    : letter.review_state === 'approved'
                      ? 'Опубликовано'
                      : letter.review_state === 'rejected'
                        ? 'Не прошло проверку'
                        : 'На проверке'}
                </p>
                <VoicePlayer path={letter.storage_path} />
                {letter.status === 'published' && (
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => void action(() => archiveLetter(letter.id))}
                  >
                    В архив
                  </button>
                )}
              </article>
            ))}
            {state.letters.filter((l) => l.status === 'published').length <
              state.limits.max_published_letters && (
              <>
                <label>
                  Тема
                  <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                    {topics.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Название
                  <input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <AudioPublicationConsent><VoiceComposer
                  min={state.limits.letter_min_seconds}
                  max={state.limits.letter_max_seconds}
                  purpose="letter"
                  label="Опубликовать аудиописьмо"
                  onSend={async (pending) => {
                    await publishLetter(pending, topic, title);
                    setTitle('');
                    await load();
                  }}
                /></AudioPublicationConsent>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export function ResponsesPage() {
  const [threads, setThreads] = useState<VoiceThread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setThreads(await voiceThreads());
    } catch (cause) {
      setError(productError(cause));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const focus = () => void load();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [load]);
  return (
    <section className="product-page">
      <PageHeader title="Отклики" eyebrow="Слышать друг друга">
        Продолжайте голосовой диалог. Открыться можно только по собственному желанию.
      </PageHeader>
      <button className="button button-secondary" disabled={busy} onClick={() => void load()}>
        Обновить
      </button>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Загружаем отклики…</p>}
      {!busy && !error && !threads.length && <p className="product-empty">Откликов пока нет.</p>}
      <div className="letter-grid">
        {threads.map((thread) => (
          <Link
            className="product-card thread-link"
            to={`/responses/${thread.thread_id}`}
            key={thread.thread_id}
          >
            <h2>{thread.state === 'disclosed' ? thread.counterpart.display_name : 'Голосовой диалог'}</h2>
            <p>{thread.letter.title || 'Аудиописьмо'}</p>
            <span>
              {thread.state === 'disclosed'
                ? 'Вы открылись друг другу'
                : ['closed', 'declined'].includes(thread.state)
                  ? 'Диалог завершён'
                  : `${thread.unheard_count} непрослушанных`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RevealedProfile({ profile }: { profile: DisclosedProfile }) {
  const [photos, setPhotos] = useState<(string | null)[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all(
      (profile.photo_paths ?? []).map((path) => signedMedia('dating-photos', path).catch(() => null)),
    ).then((urls) => {
      if (active) {
        setPhotos(urls);
        setError(urls.some((url) => !url));
      }
    });
    return () => {
      active = false;
    };
  }, [profile]);
  return (
    <section className="product-card">
      <h2>{profile.display_name}</h2>
      <p>{profile.about}</p>
      <div className="revealed-photos">
        {photos.map((url, i) =>
          url ? (
            <img key={i} src={url} alt={`Фото собеседника ${i + 1}`} />
          ) : (
            <span key={i}>Фото недоступно</span>
          ),
        )}
      </div>
      {error && <p>Часть фотографий недоступна. Обновите диалог, чтобы повторить загрузку.</p>}
      {profile.conversation_id && (
        <Link className="button button-primary" to={`/chats/${profile.conversation_id}`}>
          Перейти в чат
        </Link>
      )}
    </section>
  );
}

export function VoiceThreadPage() {
  const { threadId = '' } = useParams();
  return <VoiceThreadContent key={threadId} id={threadId} />;
}
function VoiceThreadContent({ id }: { id: string }) {
  const requestVersion = useRef(0);
  const [thread, setThread] = useState<VoiceThread | null>(null);
  const [limits, setLimits] = useState<LettersState['limits'] | null>(null);
  const [profile, setProfile] = useState<DisclosedProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const ticket = ++requestVersion.current;
    setBusy(true);
    setError(null);
    try {
      const detail = await voiceThread(id);
      const currentLimits = (await myLetters()).limits;
      const currentProfile =
        detail.state === 'disclosed' && detail.my_consent && detail.their_consent
          ? ((await disclosedProfiles()).find((p) => p.thread_id === id) ?? null)
          : null;
      if (ticket !== requestVersion.current) return;
      setThread(detail);
      setLimits(currentLimits);
      setProfile(currentProfile);
    } catch (cause) {
      if (ticket !== requestVersion.current) return;
      setThread(null);
      setProfile(null);
      setError(productError(cause));
    } finally {
      if (ticket === requestVersion.current) setBusy(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    return () => {
      requestVersion.current++;
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [load]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (cause) {
      setError(productError(cause));
    } finally {
      setBusy(false);
    }
  }
  const active = thread && ['response_sent', 'dialog'].includes(thread.state);
  return (
    <section className="product-page">
      <Link to="/responses">← Отклики</Link>
      <PageHeader
        title={
          thread?.state === 'disclosed' ? thread.counterpart.display_name || 'Диалог' : 'Голосовой диалог'
        }
        eyebrow="Слышать → Открыться → Видеть"
      />
      <button className="button button-secondary" disabled={busy} onClick={() => void load()}>
        Обновить
      </button>
      {error && <p role="alert">{error}</p>}
      {thread && (
        <>
          <p>
            {thread.my_consent ? 'Вы готовы открыться.' : 'Ваши фотографии пока закрыты.'}{' '}
            {thread.their_consent ? 'Собеседник готов открыться.' : 'Собеседник ещё не выбрал «Открыться».'}
          </p>
          {thread.letter.storage_path && <VoicePlayer path={thread.letter.storage_path} />}
          <ol className="voice-thread">
            {thread.messages?.map((message) => (
              <li key={message.id}>
                <p>{message.from_me ? 'Вы' : 'Собеседник'}</p>
                <VoicePlayer
                  path={message.storage_path}
                  onListened={async () => {
                    await markVoiceListened(message.id);
                  }}
                />
              </li>
            ))}
          </ol>
          {active && limits && (
            <>
              <VoiceComposer
                min={limits.message_min_seconds}
                max={limits.message_max_seconds}
                purpose="note"
                onSend={async (pending) => {
                  await replyVoice(id, pending);
                  await load();
                }}
              />
              <button
                className="button button-primary"
                disabled={busy || thread.state !== 'dialog'}
                onClick={() => {
                  if (
                    thread.my_consent ||
                    window.confirm('Анкета и фотографии откроются после согласия обоих. Открыться?')
                  )
                    void action(() => disclose(id, !thread.my_consent));
                }}
              >
                {thread.my_consent ? 'Отозвать готовность' : 'Открыться'}
              </button>
            </>
          )}
          {profile && <RevealedProfile profile={profile} />}
          <div className="button-row">
            {active && (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Завершить голосовой диалог?')) void action(() => closeVoiceThread(id));
                }}
              >
                Завершить диалог
              </button>
            )}
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Пожаловаться и заблокировать собеседника?'))
                  void action(() => reportLetter('thread', id));
              }}
            >
              Пожаловаться и заблокировать
            </button>
          </div>
        </>
      )}
    </section>
  );
}
