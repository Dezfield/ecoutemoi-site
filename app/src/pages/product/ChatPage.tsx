import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { blockContact, getConversations, getMessages, markConversationRead, productError, reportConversation, sendMessage, type ChatMessage, type Conversation } from '../../product/api';
import { requireSupabase } from '../../lib/supabase';

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

function messageText(message: ChatMessage) {
  if (message.deleted_for_everyone_at) return 'Сообщение удалено';
  if (message.message_type === 'text') return message.body;
  const labels: Record<string, string> = {
    image: 'Фото', voice: 'Голосовое сообщение', moment: 'Голосовой момент',
    video_note: 'Видеосообщение', meeting: 'Предложение встречи', location: 'Геопозиция',
    emoji: 'Эмодзи', sticker: 'Стикер', video_call: 'Видеозвонок',
  };
  return `${labels[message.message_type] ?? 'Сообщение'} · доступно в мобильном приложении`;
}

export function ChatPage() {
  const { conversationId = '' } = useParams();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [category, setCategory] = useState('spam');
  const [details, setDetails] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [readNotice, setReadNotice] = useState<string | null>(null);
  const pendingId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const inbox = await getConversations();
    const found = inbox.find((item) => item.conversation_id === conversationId);
    if (!found) throw new Error('Доступ к разговору закрыт.');
    setConversation(found);
    const page = await getMessages(conversationId);
    setMessages((old) => mergeMessages(old, page.messages));
    setHasMore(page.hasMore);
    // Mark read only after the history is shown, as mobile does. A failure must
    // not hide the conversation: it only leaves the unread counter as it was.
    if (Number(found.unread_count) > 0) {
      try {
        await markConversationRead(conversationId);
        setConversation({ ...found, unread_count: 0 });
        setReadNotice(null);
      } catch {
        setReadNotice('Не удалось отметить разговор прочитанным. Сообщения доступны.');
      }
    }
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setMessages([]); setConversation(null); setReadNotice(null);
    void refresh().catch((cause) => { if (active) setError(cause instanceof Error && cause.message === 'Доступ к разговору закрыт.' ? cause.message : productError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!conversation || !user) return;
    const client = requireSupabase();
    const channel = client.channel(`web-chat-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => { void refresh().catch(() => setError('Не удалось обновить разговор. Нажмите «Обновить».')); })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [conversationId, conversation?.conversation_id, refresh, user]);

  async function older() {
    if (!messages.length) return;
    try {
      const page = await getMessages(conversationId, messages[0].created_at);
      setMessages((old) => mergeMessages(page.messages, old)); setHasMore(page.hasMore);
    } catch (cause) { setError(productError(cause)); }
  }

  async function send() {
    const body = draft.trim();
    if (!body || body.length > 4000 || !user || !conversation || sending || conversation.lifecycle_status !== 'active' || conversation.blocked_by_me || conversation.blocked_by_contact || conversation.comfort_state !== 'normal' || conversation.contact_restricted) return;
    setSending(true); setSendError(null);
    const id = pendingId.current ?? crypto.randomUUID();
    pendingId.current = id;
    try { await sendMessage(conversationId, user.id, body, id); pendingId.current = null; setDraft(''); await refresh(); }
    catch (cause) { setSendError(productError(cause)); }
    finally { setSending(false); }
  }

  async function block() {
    if (!conversation || actionBusy || !window.confirm(`Заблокировать ${conversation.contact_name}?`)) return;
    setActionBusy(true);
    try { await blockContact(conversation.contact_id); await refresh(); }
    catch (cause) { setError(productError(cause)); }
    finally { setActionBusy(false); }
  }

  async function report() {
    if (!conversation || actionBusy) return;
    setActionBusy(true);
    try { await reportConversation(conversation.contact_id, conversationId, category, details); setReporting(false); setDetails(''); setError(null); }
    catch (cause) { setError(productError(cause)); }
    finally { setActionBusy(false); }
  }

  return <section className="product-page chat-page">
    <Link to="/chats">← Все чаты</Link>
    {loading ? <p role="status">Открываем разговор…</p> : null}
    {error ? <p role="alert" className="product-error">{error}</p> : null}
    {readNotice ? <p role="status" className="product-muted">{readNotice}</p> : null}
    {conversation ? <>
      <div className="chat-head"><div><p className="eyebrow">Разговор</p><h1>{conversation.contact_name}</h1></div>
        <div className="button-row"><button type="button" className="button button-secondary button-small" onClick={() => void refresh()}>Обновить</button>
          {!conversation.blocked_by_me ? <button type="button" className="button button-danger-outline button-small" disabled={actionBusy} onClick={() => void block()}>Заблокировать</button> : null}
          <button type="button" className="button button-secondary button-small" onClick={() => setReporting((value) => !value)}>Пожаловаться</button>
        </div>
      </div>
      {reporting ? <form className="product-card form" onSubmit={(event) => { event.preventDefault(); void report(); }}>
        <label>Причина <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="spam">Спам</option><option value="harassment">Преследование</option><option value="impersonation">Выдаёт себя за другого</option><option value="inappropriate">Недопустимый контент</option><option value="other">Другое</option></select></label>
        <label>Комментарий <textarea maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} /></label>
        <button type="submit" className="button button-primary" disabled={actionBusy}>Отправить жалобу</button>
      </form> : null}
      {conversation.lifecycle_status !== 'active' || conversation.blocked_by_me || conversation.blocked_by_contact || conversation.comfort_state !== 'normal' || conversation.contact_restricted ? <p className="product-empty">Разговор приостановлен. История доступна только для чтения.</p> : null}
      {hasMore ? <button type="button" className="button button-secondary button-small" onClick={() => void older()}>Ранние сообщения</button> : null}
      {!messages.length && !loading ? <p className="product-empty">Сообщений пока нет. Начните разговор.</p> : null}
      <ol className="message-list" aria-label="История сообщений">{messages.map((message) => <li key={message.id} className={message.sender_id === user?.id ? 'message-own' : 'message-other'}>
        <div className="message-bubble"><p>{messageText(message)}</p>
          <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>
      </li>)}</ol>
      {conversation.lifecycle_status === 'active' && !conversation.blocked_by_me && !conversation.blocked_by_contact && conversation.comfort_state === 'normal' && !conversation.contact_restricted ? <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label htmlFor="chat-message">Сообщение</label><textarea id="chat-message" maxLength={4000} rows={2} value={draft} onChange={(event) => { setDraft(event.target.value); pendingId.current = null; }} />
        <button type="submit" className="button button-primary" disabled={sending || !draft.trim()}>{sending ? 'Отправляем…' : sendError ? 'Повторить отправку' : 'Отправить'}</button>
        {sendError ? <p role="alert" className="product-error">{sendError}</p> : null}
      </form> : null}
    </> : null}
  </section>;
}
