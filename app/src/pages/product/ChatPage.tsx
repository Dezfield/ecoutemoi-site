import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import {
  blockContact,
  getConversations,
  getMessages,
  markConversationRead,
  productError,
  reportConversation,
  sendMessage,
  type ChatMessage,
  type Conversation,
} from '../../product/api';
import {
  brandedEmojiCatalog,
  brandedEmojiInfoFromMessageBody,
  brandedEmojiMessageBody,
} from '../../product/brandedEmojiCatalog';
import {
  deleteMessage,
  editMessage,
  loadReactions,
  momentTimeline,
  openPhoto,
  reactions,
  sendGraphic,
  sendPhoto,
  stickers,
  toggleReaction,
  uploadPhoto,
  validatePhoto,
  visibleMessage,
  type PendingPhoto,
  type PhotoMode,
  type Reaction,
} from '../../product/chat';
import { requireSupabase } from '../../lib/supabase';

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
const writable = (c: Conversation | null) =>
  Boolean(
    c &&
      c.lifecycle_status === 'active' &&
      !c.blocked_by_me &&
      !c.blocked_by_contact &&
      c.comfort_state === 'normal' &&
      !c.contact_restricted,
  );
function Graphic({ message }: { message: ChatMessage }) {
  const emoji = brandedEmojiInfoFromMessageBody(message.body);
  if (emoji)
    return (
      <img className="branded-emoji" src={`/brand/emojis/${emoji.key.slice(6)}.png`} alt={emoji.label} />
    );
  const sticker = stickers.find((s) => `sticker:${s.key}` === message.body);
  if (sticker)
    return <img className="branded-sticker" src={`/brand/stickers/${sticker.file}`} alt={sticker.label} />;
  return (
    <p>
      {message.message_type === 'emoji' && !message.body.startsWith('emoji:')
        ? message.body
        : 'Смайл недоступен'}
    </p>
  );
}
function PhotoDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const timer = window.setTimeout(onClose, 60000);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return (
    <dialog
      className="photo-dialog"
      ref={dialog}
      aria-label="Фотография"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button className="button button-secondary" autoFocus onClick={onClose}>
        Закрыть фото
      </button>
      <img src={url} alt="Фотография в разговоре" onError={onClose} />
    </dialog>
  );
}
export function ChatPage() {
  const { conversationId = '' } = useParams();
  const { user } = useAuth();
  return <ChatContent key={`${user?.id}:${conversationId}`} id={conversationId} />;
}
function ChatContent({ id }: { id: string }) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inbox, setInbox] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const currentMessages = useRef(messages);
  currentMessages.current = messages;
  const [summary, setSummary] = useState<Reaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [tab, setTab] = useState('chat');
  const [panel, setPanel] = useState<'emoji' | 'stickers' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<PhotoMode>('persistent');
  const [photo, setPhoto] = useState<{ url: string; id: string; expires: number } | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [reporting, setReporting] = useState(false);
  const [reportCategory, setReportCategory] = useState('inappropriate');
  const [details, setDetails] = useState('');
  const pendingId = useRef<string | null>(null);
  const pendingSignature = useRef('');
  const pendingPhoto = useRef<PendingPhoto | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const sendingLock = useRef(false);
  const closePhoto = useCallback(() => setPhoto(null), []);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    const inbox = await getConversations();
    if (!alive.current || ticket !== generation.current) return;
    setInbox(inbox);
    const found = inbox.find((c) => c.conversation_id === id);
    if (!found) {
      setConversation(null);
      setMessages([]);
      setSummary([]);
      setPhoto(null);
      throw new Error('Доступ к разговору закрыт.');
    }
    setConversation(found);
    const page = await getMessages(id);
    if (!alive.current || ticket !== generation.current) return;
    const merged = mergeMessages(currentMessages.current, page.messages);
    setMessages(merged);
    if (merged.length <= 30) setHasMore(page.hasMore);
    const values = await loadReactions(merged.map((m) => m.id));
    if (alive.current && ticket === generation.current) setSummary(values);
    if (found.unread_count > 0)
      await markConversationRead(id).catch(() => {
        if (alive.current) setError('Не удалось отметить разговор прочитанным.');
      });
  }, [id]);
  useEffect(() => {
    alive.current = true;
    void refresh()
      .catch(() => {
        if (alive.current) setError('Не удалось загрузить разговор. Повторите обновление.');
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (!conversation || !user) return;
    const client = requireSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          void refresh().catch(() => {
            if (alive.current) setError('Не удалось обновить разговор. Нажмите «Обновить».');
          }),
        100,
      );
    };
    const channel = client
      .channel(`web-chat-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        reload,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, reload)
      .subscribe();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 20000);
    window.addEventListener('focus', reload);
    return () => {
      clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener('focus', reload);
      void client.removeChannel(channel);
    };
  }, [conversation?.conversation_id, id, refresh, user]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (photo && (photo.expires <= now || !messages.some((m) => m.id === photo.id && visibleMessage(m, now))))
      setPhoto(null);
  }, [photo, now, messages]);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function older() {
    if (olderBusy || !messages.length) return;
    setOlderBusy(true);
    try {
      const page = await getMessages(id, messages[0]);
      if (!alive.current) return;
      const merged = mergeMessages(page.messages, currentMessages.current);
      setMessages(merged);
      setHasMore(page.hasMore);
      setSummary(await loadReactions(merged.map((m) => m.id)));
    } catch (cause) {
      if (alive.current) setError(productError(cause));
    } finally {
      if (alive.current) setOlderBusy(false);
    }
  }
  async function send(kind: 'text' | 'emoji' | 'sticker' | 'photo' = 'text', body = draft.trim()) {
    if (
      !user ||
      !writable(conversation) ||
      sendingLock.current ||
      (kind === 'text' && (!body || body.length > 4000))
    )
      return;
    sendingLock.current = true;
    setSending(true);
    setSendError(null);
    const signature = `${kind}:${body}:${reply?.id ?? ''}`;
    const key =
      pendingSignature.current === signature && pendingId.current ? pendingId.current : crypto.randomUUID();
    pendingSignature.current = signature;
    pendingId.current = key;
    try {
      if (kind === 'photo') {
        if (!file) return;
        pendingPhoto.current ??= await uploadPhoto(id, user.id, file, mode);
        await sendPhoto(id, user.id, pendingPhoto.current);
      } else if (kind === 'text') await sendMessage(id, user.id, body, key, reply?.id ?? null);
      else await sendGraphic(id, user.id, kind, body, key);
      pendingId.current = null;
      pendingPhoto.current = null;
      setDraft('');
      setFile(null);
      setReply(null);
      setPanel(null);
      try {
        await refresh();
      } catch {
        setError('Сообщение отправлено. Не удалось обновить историю — нажмите «Обновить».');
      }
    } catch (cause) {
      setSendError(productError(cause));
    } finally {
      sendingLock.current = false;
      if (alive.current) setSending(false);
    }
  }
  async function action(fn: () => Promise<unknown>) {
    if (actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (cause) {
      setError(productError(cause));
    } finally {
      if (alive.current) setActionBusy(false);
    }
  }
  async function viewPhoto(message: ChatMessage) {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const url = await openPhoto(message, message.sender_id === user?.id);
      if (!alive.current) return;
      setOpened((old) => new Set([...old, message.id]));
      setPhoto({
        url,
        id: message.id,
        expires: Math.min(Date.now() + 60000, message.expires_at ? Date.parse(message.expires_at) : Infinity),
      });
    } catch {
      setError('Фото недоступно: срок доступа истёк или одноразовый просмотр уже использован.');
    } finally {
      setActionBusy(false);
    }
  }
  function content(message: ChatMessage) {
    if (!visibleMessage(message, now))
      return <p>{message.deleted_for_everyone_at ? 'Сообщение удалено' : 'Срок доступа истёк'}</p>;
    if (message.message_type === 'text') return <p>{message.body}</p>;
    if (['emoji', 'sticker'].includes(message.message_type)) return <Graphic message={message} />;
    if (message.message_type === 'image')
      return (
        <button
          className="button button-secondary"
          disabled={
            actionBusy ||
            (message.image_access_mode === 'view_once' &&
              message.sender_id !== user?.id &&
              opened.has(message.id))
          }
          onClick={() => void viewPhoto(message)}
        >
          {message.image_access_mode === 'view_once'
            ? opened.has(message.id)
              ? 'Просмотрено'
              : 'Открыть один раз'
            : message.image_access_mode === '24_hours'
              ? 'Фото · 24 часа'
              : 'Открыть фото'}
        </button>
      );
    return (
      <p>
        {(
          {
            voice: 'Голосовое сообщение',
            moment: 'Голосовой Момент',
            video_note: 'Видеокружок',
            meeting: 'Предложение встречи',
          } as Record<string, string>
        )[message.message_type] ?? 'Сообщение'}{' '}
        · доступно в приложении Écoute Moi
      </p>
    );
  }
  const shown =
    tab === 'shared'
      ? messages.filter((m) => m.message_type === 'image' && visibleMessage(m, now))
      : messages;
  return (
    <div className="chat-workspace">
      <aside className="chat-inbox" aria-label="Другие разговоры">
        <h2>Чаты</h2>
        {inbox.map((c) => (
          <Link
            key={c.conversation_id}
            to={`/chats/${c.conversation_id}`}
            aria-current={c.conversation_id === id ? 'page' : undefined}
          >
            <strong>{c.contact_name}</strong>
            <span>
              {c.last_message_text || 'Диалог'}
              {Number(c.unread_count) > 0 ? ` · ${c.unread_count} новых` : ''}
            </span>
          </Link>
        ))}
      </aside>
      <section className="product-page chat-page">
        <Link to="/chats">← Все чаты</Link>
        {loading && <p role="status">Открываем разговор…</p>}
        {error && (
          <p role="alert" className="product-error">
            {error}
          </p>
        )}
        <div className="chat-head">
          <h1>{conversation?.contact_name || 'Чат'}</h1>
          <button
            className="button button-secondary"
            onClick={() => {
              setError(null);
              void refresh().catch(() => setError('Не удалось обновить разговор.'));
            }}
          >
            Обновить
          </button>
        </div>
        {conversation && (
          <>
            <div className="button-row">
              <button
                className="button button-secondary"
                disabled={actionBusy}
                onClick={() => {
                  if (window.confirm('Заблокировать собеседника?'))
                    void action(() => blockContact(conversation.contact_id));
                }}
              >
                Заблокировать
              </button>
              <button className="button button-secondary" onClick={() => setReporting(!reporting)}>
                Пожаловаться
              </button>
            </div>
            {reporting && (
              <form
                className="form product-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await reportConversation(conversation.contact_id, id, reportCategory, details);
                    setReporting(false);
                  });
                }}
              >
              <label>Причина<select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}>{[['spam','Спам'],['harassment','Преследование'],['impersonation','Выдаёт себя за другого'],['inappropriate','Недопустимый контент'],['other','Другое']].map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>
                  Комментарий
                  <textarea value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
                </label>
                <button className="button button-primary" disabled={actionBusy}>
                  Отправить жалобу
                </button>
              </form>
            )}
            <div className="chat-tabs" role="tablist" aria-label="История общения">
              {[
                ['chat', 'Чат'],
                ['moments', 'Моменты'],
                ['shared', 'То, чем поделились'],
              ].map(([key, label]) => (
                <button role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key)}>
                  {label}
                </button>
              ))}
            </div>
            {hasMore && (
              <button className="button button-secondary" disabled={olderBusy} onClick={() => void older()}>
                {olderBusy ? 'Загружаем…' : 'Ранние сообщения'}
              </button>
            )}
            {tab === 'moments' ? (
              <ol className="moment-timeline">
                {momentTimeline(messages, summary, now).map((event) => (
                  <li key={event.id}>
                    <h2>{event.title}</h2>
                    <time>{new Date(event.message.created_at).toLocaleString('ru-RU')}</time>
                    {content(event.message)}
                  </li>
                ))}
              </ol>
            ) : (
              <ol className="message-list" aria-label="История сообщений">
                {shown.map((message) => (
                  <li
                    key={message.id}
                    className={message.sender_id === user?.id ? 'message-own' : 'message-other'}
                  >
                    <div className="message-bubble">
                      {message.reply_to_message_id && (
                        <blockquote>
                          {messages.find(
                            (m) => m.id === message.reply_to_message_id && visibleMessage(m, now),
                          )?.body || 'Ответ на сообщение'}
                        </blockquote>
                      )}
                      {content(message)}
                      <time dateTime={message.created_at}>
                        {new Date(message.created_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {message.edited_at ? ' · изменено' : ''}
                        {message.sender_id === user?.id
                          ? conversation.contact_last_read_at &&
                            Date.parse(conversation.contact_last_read_at) >= Date.parse(message.created_at)
                            ? ' · прочитано'
                            : ' · отправлено'
                          : ''}
                      </time>
                      {visibleMessage(message, now) && (
                        <>
                          <div className="reaction-summary">
                            {summary
                              .filter((r) => r.message_id === message.id)
                              .map((r) => (
                                <button
                                  key={r.reaction_code}
                                  disabled={!writable(conversation) || actionBusy}
                                  aria-pressed={r.reacted_by_me}
                                  onClick={() =>
                                    void action(() => toggleReaction(message.id, r.reaction_code))
                                  }
                                >
                                  {reactions[r.reaction_code]} {r.reaction_count}
                                </button>
                              ))}
                          </div>
                          {writable(conversation) && (
                            <details>
                              <summary>Действия с сообщением</summary>
                              <div className="button-row">
                                {(Object.keys(reactions) as (keyof typeof reactions)[]).map((code) => (
                                  <button
                                    key={code}
                                    disabled={actionBusy}
                                    aria-label={`Реакция ${code}`}
                                    onClick={() => void action(() => toggleReaction(message.id, code))}
                                  >
                                    {reactions[code]}
                                  </button>
                                ))}
                                <button onClick={() => setReply(message)}>Ответить</button>
                                {message.sender_id === user?.id && (
                                  <>
                                    {message.message_type === 'text' && (
                                      <button
                                        onClick={() => {
                                          const body = window.prompt('Изменить сообщение', message.body);
                                          if (body?.trim() && body.trim().length <= 4000)
                                            void action(() => editMessage(message.id, body));
                                        }}
                                      >
                                        Изменить
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (window.confirm('Удалить сообщение у всех?'))
                                          void action(() => deleteMessage(message.id));
                                      }}
                                    >
                                      Удалить у всех
                                    </button>
                                  </>
                                )}
                              </div>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {!writable(conversation) ? (
              <p className="product-empty">Разговор приостановлен. История доступна только для чтения.</p>
            ) : (
              <>
                <form
                  className="chat-compose"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  {reply && (
                    <p>
                      Ответ на сообщение{' '}
                      <button type="button" onClick={() => setReply(null)}>
                        Отменить ответ
                      </button>
                    </p>
                  )}
                  <label htmlFor="chat-message">Сообщение</label>
                  <textarea
                    id="chat-message"
                    maxLength={4000}
                    rows={2}
                    disabled={sending}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      pendingId.current = null;
                    }}
                  />
                  <button className="button button-primary" disabled={sending || !draft.trim()}>
                    {sending ? 'Отправляем…' : sendError ? 'Повторить отправку' : 'Отправить'}
                  </button>
                </form>
                <div className="chat-attachments">
                  <button
                    className="button button-secondary"
                    disabled={sending}
                    onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}
                  >
                    Смайлы
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={sending}
                    onClick={() => setPanel(panel === 'stickers' ? null : 'stickers')}
                  >
                    Стикеры
                  </button>
                  <label className="button button-secondary">
                    Фотография
                    <input
                      aria-label="Выбрать фотографию"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={sending}
                      onChange={(e) => {
                        const next = e.target.files?.[0];
                        e.target.value = '';
                        if (!next) return;
                        try {
                          validatePhoto(next);
                          setFile(next);
                          pendingPhoto.current = null;
                          setSendError(null);
                        } catch (cause) {
                          setSendError(cause instanceof Error ? cause.message : 'Фото недоступно.');
                        }
                      }}
                    />
                  </label>
                </div>
                {panel && (
                  <div className="graphic-picker" aria-label="Фирменная графика">
                    {panel === 'emoji'
                      ? brandedEmojiCatalog.map((emoji) => (
                          <button
                            disabled={sending}
                            key={emoji.key}
                            aria-label={emoji.label}
                            onClick={() => {
                              void send('emoji', brandedEmojiMessageBody(emoji.key));
                            }}
                          >
                            <img src={`/brand/emojis/${emoji.key.slice(6)}.png`} alt="" />
                            <span>{emoji.label}</span>
                          </button>
                        ))
                      : stickers.map((sticker) => (
                          <button
                            disabled={sending}
                            key={sticker.key}
                            aria-label={sticker.label}
                            onClick={() => {
                              void send('sticker', `sticker:${sticker.key}`);
                            }}
                          >
                            <img src={`/brand/stickers/${sticker.file}`} alt="" />
                            <span>{sticker.label}</span>
                          </button>
                        ))}
                  </div>
                )}
                {preview && (
                  <div className="photo-preview">
                    <img src={preview} alt="Предпросмотр фотографии" />
                    <label htmlFor="photo-access">Доступ</label>
                    <select
                      id="photo-access"
                      disabled={sending}
                      value={mode}
                      onChange={(e) => {
                        setMode(e.target.value as PhotoMode);
                        pendingPhoto.current = null;
                      }}
                    >
                      <option value="persistent">Обычная фотография</option>
                      <option value="view_once">Один просмотр</option>
                      <option value="24_hours">24 часа</option>
                    </select>
                    <button
                      className="button button-primary"
                      disabled={sending}
                      onClick={() => void send('photo')}
                    >
                      {sending ? 'Загружаем…' : 'Отправить фото'}
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={sending}
                      onClick={() => {
                        setFile(null);
                        pendingPhoto.current = null;
                      }}
                    >
                      Убрать фото
                    </button>
                  </div>
                )}
                {sendError && (
                  <p role="alert" className="product-error">
                    {sendError}
                  </p>
                )}
              </>
            )}
          </>
        )}
        {photo && <PhotoDialog url={photo.url} onClose={closePhoto} />}
      </section>
    </div>
  );
}
