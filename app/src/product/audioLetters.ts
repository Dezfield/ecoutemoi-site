import { requireSupabase } from '../lib/supabase';

// Exact wire shapes from mobile main src/services/audioLetters.ts. No profile
// identity or photos belong in a feed item or an undisclosed voice thread.
export type Letter = {
  impression_id: string;
  topic_key: string;
  title: string | null;
  storage_path: string;
  duration_seconds: number;
  context: { age: number | null; city: string | null };
  listened: boolean;
};
export type OwnLetter = {
  id: string;
  title: string | null;
  storage_path: string;
  duration_seconds: number;
  review_state: string;
  status: string;
};
export type LettersState = {
  enabled: boolean;
  limits: {
    letter_min_seconds: number;
    letter_max_seconds: number;
    response_min_seconds: number;
    response_max_seconds: number;
    message_min_seconds: number;
    message_max_seconds: number;
    max_published_letters: number;
  };
  letters: OwnLetter[];
};
export type VoiceThread = {
  thread_id: string;
  state: string;
  my_consent: boolean;
  their_consent: boolean;
  unheard_count: number;
  counterpart: {
    age: number | null;
    city: string | null;
    display_name: string | null;
    conversation_id: string | null;
  };
  letter: { title: string | null; storage_path: string | null };
  messages?: { id: string; from_me: boolean; storage_path: string; listened: boolean }[];
};
export type DisclosedProfile = {
  thread_id: string;
  display_name: string;
  about: string | null;
  photo_paths: string[];
  conversation_id: string | null;
};
export const topics = [
  ['relationships', 'Отношения'],
  ['life', 'Жизнь'],
  ['values', 'Ценности'],
  ['humor', 'Юмор'],
  ['travel', 'Путешествия'],
  ['music', 'Музыка'],
  ['question', 'Вопрос незнакомцу'],
  ['free', 'Свободная тема'],
] as const;

export async function myLetters() {
  const { data, error } = await requireSupabase().rpc('get_my_audio_letters_v1');
  if (error) throw error;
  return data as LettersState;
}
export async function letterFeed() {
  const { data, error } = await requireSupabase().rpc('get_audio_letter_feed_v1', { p_limit: 5 });
  if (error) throw error;
  return data as { items: Letter[]; resets_at: string | null; daily_limit: number };
}
export async function listened(impressionId: string) {
  const { error } = await requireSupabase().rpc('mark_audio_letter_listened_v1', {
    p_impression_id: impressionId,
    p_completed: true,
  });
  if (error) throw error;
}
export async function skipLetter(impressionId: string) {
  const { error } = await requireSupabase().rpc('skip_audio_letter_v1', { p_impression_id: impressionId });
  if (error) throw error;
}
export type PendingVoice = { path: string; key: string; seconds: number };
export async function prepareClip(
  blob: Blob,
  seconds: number,
  purpose: 'letter' | 'note',
): Promise<PendingVoice> {
  if (!['audio/webm', 'audio/mp4'].includes(blob.type) || blob.size < 2000 || blob.size > 3 * 1024 * 1024)
    throw new Error('Нужна запись WebM или MP4 размером до 3 МБ.');
  const client = requireSupabase();
  const { data, error } = await client.rpc('prepare_voice_upload_v1', { p_purpose: purpose });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Не удалось подготовить запись.');
  const uploaded = await client.storage
    .from('dating-audio')
    .upload(data, blob, { contentType: blob.type, cacheControl: '0', upsert: false });
  if (uploaded.error) throw uploaded.error;
  return { path: data, key: crypto.randomUUID(), seconds };
}
export async function publishLetter(pending: PendingVoice, topic: string, title: string) {
  const { data, error } = await requireSupabase().rpc('publish_audio_letter_v1', {
    p_storage_path: pending.path,
    p_duration_seconds: pending.seconds,
    p_topic_key: topic,
    p_title: title.trim() || null,
  });
  if (error) throw error;
  return data as { letter_id: string; review_state: string };
}
export async function archiveLetter(id: string) {
  const { error } = await requireSupabase().rpc('set_audio_letter_status_v1', {
    p_letter_id: id,
    p_status: 'archived',
  });
  if (error) throw error;
}
export async function respondLetter(id: string, pending: PendingVoice) {
  const { data, error } = await requireSupabase().rpc('send_letter_response_v1', {
    p_impression_id: id,
    p_storage_path: pending.path,
    p_duration_seconds: pending.seconds,
    p_client_message_id: pending.key,
    p_anchor_timestamp_ms: null,
  });
  if (error) throw error;
  return data as { thread_id: string };
}
export async function voiceThreads() {
  const { data, error } = await requireSupabase().rpc('get_my_voice_threads_v1');
  if (error) throw error;
  return (data ?? []) as VoiceThread[];
}
export async function voiceThread(id: string) {
  const { data, error } = await requireSupabase().rpc('get_voice_thread_v1', { p_thread_id: id });
  if (error) throw error;
  return data as VoiceThread;
}
export async function replyVoice(id: string, pending: PendingVoice) {
  const { error } = await requireSupabase().rpc('send_voice_thread_message_v1', {
    p_thread_id: id,
    p_storage_path: pending.path,
    p_duration_seconds: pending.seconds,
    p_client_message_id: pending.key,
  });
  if (error) throw error;
}
export async function markVoiceListened(id: string) {
  const { error } = await requireSupabase().rpc('mark_voice_thread_message_listened_v1', {
    p_message_id: id,
  });
  if (error) throw error;
}
export async function disclose(id: string, consent: boolean) {
  const { error } = await requireSupabase().rpc('set_disclosure_consent_v1', {
    p_thread_id: id,
    p_consent: consent,
  });
  if (error) throw error;
}
export async function disclosedProfiles() {
  const { data, error } = await requireSupabase().rpc('get_my_disclosed_profiles_v1');
  if (error) throw error;
  return (data ?? []) as DisclosedProfile[];
}
export async function closeVoiceThread(id: string) {
  const { error } = await requireSupabase().rpc('end_voice_thread_v1', { p_thread_id: id });
  if (error) throw error;
}
export async function reportLetter(targetType: 'impression' | 'thread', id: string) {
  const { error } = await requireSupabase().rpc('report_voice_content_v1', {
    p_target_type: targetType,
    p_target_id: id,
    p_category: 'inappropriate',
    p_details: '',
    p_block_user: true,
  });
  if (error) throw error;
}
