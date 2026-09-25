import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { getConversations, productError, type Conversation } from '../../product/api';

export function ChatsPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setError(null);
    try { setItems(await getConversations()); }
    catch (cause) { setError(productError(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="product-page">
    <PageHeader eyebrow="После взаимности" title="Чаты">Ваши разговоры сохраняются между телефоном и браузером.</PageHeader>
    <div className="button-row"><button type="button" className="button button-secondary button-small" onClick={() => void load()}>Обновить</button></div>
    {loading ? <p role="status">Загружаем чаты…</p> : null}
    {error ? <p role="alert" className="product-error">{error}</p> : null}
    {!loading && !error && !items.length ? <p className="product-empty">Чатов пока нет</p> : null}
    <ul className="chat-list">{items.map((item) => <li key={item.conversation_id}>
      <Link to={`/chats/${item.conversation_id}`} className="chat-list-link">
        <span className="chat-list-main"><strong>{item.contact_name}</strong><span>{item.last_message_text ?? 'Начните разговор'}</span></span>
        <span className="chat-list-meta"><time dateTime={item.last_message_at}>{new Date(item.last_message_at).toLocaleDateString('ru-RU')}</time>
          {Number(item.unread_count) > 0 ? <span className="unread-badge" aria-label={`Непрочитанных сообщений: ${item.unread_count}`}>{item.unread_count}</span> : null}
          {item.lifecycle_status !== 'active' ? <span>{item.lifecycle_status === 'ended' ? 'Завершён' : 'Закрыт'}</span> : null}
        </span>
      </Link>
    </li>)}</ul>
  </section>;
}
