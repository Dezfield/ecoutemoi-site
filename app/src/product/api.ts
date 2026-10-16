import { requireSupabase } from '../lib/supabase';
import { voiceMediaLink } from './voiceLinks';

export type Conversation = {
  conversation_id: string;
  contact_id: string;
  contact_name: string;
  contact_avatar_path: string | null;
  last_message_text: string | null;
  last_message_at: string;
  unread_count: number;
  contact_last_read_at?: string | null;
  blocked_by_me: boolean;
  blocked_by_contact: boolean;
  lifecycle_status: string;
  comfort_state: string;
  contact_restricted: boolean;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: string;
  media_path: string | null;
  deleted_for_everyone_at: string | null;
  created_at: string;
  expires_at: string | null;
  edited_at: string | null;
  image_access_mode: 'persistent' | '24_hours' | 'view_once';
  reply_to_message_id: string | null;
};

export async function signedMedia(bucket: 'dating-audio' | 'dating-photos', path: string): Promise<string> {
  // Audio: a server-issued short link; photos keep the existing signed URL.
  if (bucket === 'dating-audio') return voiceMediaLink(path);
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await requireSupabase().rpc('get_my_inbox_v2');
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function getMessages(
  conversationId: string,
  before: { created_at: string; id: string } | null = null,
) {
  let query = requireSupabase()
    .from('messages')
    .select(
      'id, conversation_id, sender_id, body, message_type, media_path, deleted_for_everyone_at, expires_at, edited_at, image_access_mode, reply_to_message_id, created_at',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (before) {
    if (!/^[0-9a-f-]{36}$/i.test(before.id) || !Number.isFinite(Date.parse(before.created_at)))
      throw new Error('Некорректная страница истории.');
    query = query.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query.limit(31);
  if (error) throw error;
  const rows = (data ?? []) as ChatMessage[];
  return { messages: rows.slice(0, 30).reverse(), hasMore: rows.length > 30 };
}

// Same contract as mobile: the actor comes from the JWT; the server moves only
// the caller's own read marker and rejects a conversation it is not part of.
export async function markConversationRead(conversationId: string) {
  const { error } = await requireSupabase().rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  clientId: string,
  replyId: string | null = null,
) {
  const { error } = await requireSupabase().from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    message_type: 'text',
    reply_to_message_id: replyId,
    client_message_id: clientId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function blockContact(contactId: string) {
  const { error } = await requireSupabase().rpc('block_user', { p_blocked_user_id: contactId });
  if (error) throw error;
}

export async function reportConversation(
  contactId: string,
  conversationId: string,
  category: string,
  details: string,
) {
  const { data, error } = await requireSupabase().rpc('submit_user_report', {
    p_reported_user_id: contactId,
    p_conversation_id: conversationId,
    p_message_id: null,
    p_category: category,
    p_details: details,
  });
  if (error) throw error;
  if (!data) throw new Error('Лимит жалоб исчерпан. Попробуйте позже.');
}

export function productError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === '42501') return 'Действие недоступно: проверьте статус аккаунта или отношения с собеседником.';
  if (code === 'PGRST116') return 'Данные недоступны для этого аккаунта.';
  return 'Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.';
}
