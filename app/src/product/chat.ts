import { requireSupabase } from '../lib/supabase';
import { visibleMessage } from './chatModel';
export { visibleMessage, momentTimeline } from './chatModel';
import type { ChatMessage } from './api';
export type PhotoMode = 'persistent' | '24_hours' | 'view_once';
export const reactions = { heart: '❤️', laugh: '😂', fire: '🔥', like: '👍', wow: '😮', sad: '😢' } as const;
export type Reaction = {
  message_id: string;
  reaction_code: keyof typeof reactions;
  reaction_count: number;
  reacted_by_me: boolean;
};
export const stickers = [
  { key: 'soroka_listening', label: 'Я слушаю', file: 'soroka-listening.png' },
  { key: 'soroka_hello', label: 'Сорока рядом', file: 'soroka-hello.png' },
  { key: 'spider_typing', label: 'Уже пишу', file: 'spider-typing.png' },
  { key: 'spider_protect', label: 'Под защитой', file: 'spider-protect.png' },
  { key: 'good_morning', label: 'Доброе утро!', file: 'good-morning.webp' },
  { key: 'goofy_smile', label: 'Придурковатый смайл', file: 'goofy-smile.webp' },
  { key: 'vo', label: 'Во!', file: 'vo.webp' },
] as const;
export async function loadReactions(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await requireSupabase().rpc('get_message_reactions', { p_message_ids: ids });
  if (error) throw error;
  return (data ?? []) as Reaction[];
}
export async function toggleReaction(id: string, code: keyof typeof reactions) {
  const { error } = await requireSupabase().rpc('toggle_message_reaction', {
    p_message_id: id,
    p_reaction_code: code,
  });
  if (error) throw error;
}
export async function editMessage(id: string, body: string) {
  const { error } = await requireSupabase().rpc('edit_chat_message', {
    p_message_id: id,
    p_body: body.trim(),
  });
  if (error) throw error;
}
export async function deleteMessage(id: string) {
  const { error } = await requireSupabase().rpc('delete_chat_message_for_everyone', { p_message_id: id });
  if (error) throw error;
}
export async function sendGraphic(
  conversation: string,
  sender: string,
  kind: 'emoji' | 'sticker',
  body: string,
  key: string,
) {
  const { error } = await requireSupabase()
    .from('messages')
    .insert({
      conversation_id: conversation,
      sender_id: sender,
      body,
      message_type: kind,
      client_message_id: key,
    });
  if (error && error.code !== '23505') throw error;
}
export function validatePhoto(file: Blob) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Выберите JPEG, PNG или WebP размером до 5 МБ.');
}
export type PendingPhoto = { path: string; key: string; mode: PhotoMode; expires: string | null };
export async function uploadPhoto(
  conversation: string,
  sender: string,
  file: Blob,
  mode: PhotoMode,
): Promise<PendingPhoto> {
  validatePhoto(file);
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const key = crypto.randomUUID();
  const path = `${sender}/${conversation}/${key}.${extension}`;
  const { error } = await requireSupabase()
    .storage.from('chat-media')
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '0' });
  if (error) throw error;
  return {
    path,
    key,
    mode,
    expires: mode === '24_hours' ? new Date(Date.now() + 86400000).toISOString() : null,
  };
}
export async function sendPhoto(conversation: string, sender: string, pending: PendingPhoto) {
  // Retrying an ambiguous insert reuses BOTH path and client_message_id. Never
  // delete uploaded bytes on a network error: the message may already exist.
  const { error } = await requireSupabase()
    .from('messages')
    .insert({
      conversation_id: conversation,
      sender_id: sender,
      body: 'Фотография',
      message_type: 'image',
      media_path: pending.path,
      media_duration_seconds: null,
      image_access_mode: pending.mode,
      expires_at: pending.expires,
      client_message_id: pending.key,
    });
  if (error && error.code !== '23505') throw error;
}
export async function openPhoto(message: ChatMessage, own: boolean) {
  if (!visibleMessage(message) || !message.media_path) throw new Error('Фото недоступно.');
  let path = message.media_path;
  if (message.image_access_mode === 'view_once' && !own) {
    const { data, error } = await requireSupabase().rpc('consume_image_message', {
      p_message_id: message.id,
    });
    if (error) throw error;
    const row = (data as { allowed: boolean; media_path: string | null }[] | null)?.[0];
    if (!row?.allowed || !row.media_path) throw new Error('Одноразовое фото уже просмотрено или недоступно.');
    path = row.media_path;
  }
  const ttl = message.expires_at
    ? Math.max(1, Math.min(300, Math.floor((Date.parse(message.expires_at) - Date.now()) / 1000)))
    : 300;
  const { data, error } = await requireSupabase().storage.from('chat-media').createSignedUrl(path, ttl);
  if (error) throw error;
  return data.signedUrl;
}
