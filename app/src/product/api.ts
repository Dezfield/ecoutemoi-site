import { requireSupabase } from '../lib/supabase';

export type Voice = {
  impression_id: string;
  prompt_key: string;
  audio_path: string;
  audio_duration_seconds: number;
  age: number | null;
  city: string | null;
  relationship_goal: string | null;
  shared_interests: string[] | null;
};

export type Resonance = {
  resonance_id: string;
  contact_id: string;
  display_name: string;
  about: string | null;
  age: number;
  city: string;
  relationship_goal: string;
  interests: string[];
  photo_paths: string[];
  my_photo_decision: 'interest' | 'pass' | null;
  stage: 'resonance' | 'mutuality';
  conversation_id: string | null;
  resonated_at: string;
};

export type Conversation = {
  conversation_id: string;
  contact_id: string;
  contact_name: string;
  contact_avatar_path: string | null;
  last_message_text: string | null;
  last_message_at: string;
  unread_count: number;
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
};

export async function signedMedia(bucket: 'dating-audio' | 'dating-photos', path: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

type OwnDatingProfile = {
  display_name: string; birth_date: string | null; city: string | null;
  gender_code: string | null; looking_for: string[]; relationship_goal: string | null;
  interests: string[]; languages: string[]; preferred_min_age: number;
  preferred_max_age: number; audio_prompt_key: string | null; photo_paths: string[];
  discovery_enabled: boolean; onboarding_complete: boolean;
};

export async function saveOwnVoice(blob: Blob, duration: number) {
  if (duration < 20 || duration > 45 || blob.size > 3 * 1024 * 1024 || !['audio/webm', 'audio/mp4'].includes(blob.type)) {
    throw new Error('Запись должна длиться 20–45 секунд и быть меньше 3 МБ.');
  }
  const client = requireSupabase();
  const profileResult = await client.rpc('get_my_dating_profile_v5');
  if (profileResult.error) throw profileResult.error;
  const profile = (profileResult.data as OwnDatingProfile[] | null)?.[0];
  if (!profile?.onboarding_complete || !profile.birth_date || !profile.city || !profile.gender_code || !profile.relationship_goal || !profile.audio_prompt_key || !profile.photo_paths?.length) {
    throw new Error('Сначала завершите анкету в мобильном приложении.');
  }
  const prepared = await client.rpc('prepare_my_dating_media');
  if (prepared.error) throw prepared.error;
  const path = (prepared.data as { audio_path: string }[] | null)?.[0]?.audio_path;
  if (!path) throw new Error('Не удалось подготовить аудиописьмо.');
  const uploaded = await client.storage.from('dating-audio').upload(path, blob, { contentType: blob.type, upsert: true });
  if (uploaded.error) throw uploaded.error;
  const saved = await client.rpc('save_my_dating_profile', {
    p_display_name: profile.display_name,
    p_birth_date: profile.birth_date,
    p_city: profile.city,
    p_gender_code: profile.gender_code,
    p_looking_for: profile.looking_for,
    p_relationship_goal: profile.relationship_goal,
    p_interests: profile.interests,
    p_languages: profile.languages,
    p_preferred_min_age: profile.preferred_min_age,
    p_preferred_max_age: profile.preferred_max_age,
    p_audio_prompt_key: profile.audio_prompt_key,
    p_audio_path: path,
    p_audio_duration_seconds: duration,
    p_photo_paths: profile.photo_paths,
    p_discovery_enabled: profile.discovery_enabled,
  });
  if (saved.error) throw saved.error;
}

// get_voice_candidates_v4 records new impressions that its own outer query
// cannot see yet: the first call of a day can return [] and the next call
// returns them. Ask exactly once more before showing an empty state; never poll.
export async function getVoices(): Promise<Voice[]> {
  for (let attempt = 1; ; attempt += 1) {
    const { data, error } = await requireSupabase().rpc('get_voice_candidates_v4', { p_limit: 10 });
    if (error) throw error;
    const voices = (data ?? []) as Voice[];
    if (voices.length || attempt === 2) return voices;
  }
}

export async function respondToVoice(impressionId: string, interested: boolean, reason: string | null) {
  const { data, error } = await requireSupabase().rpc('respond_to_voice_candidate_v2', {
    p_impression_id: impressionId,
    p_interested: interested,
    p_interest_reason: interested ? reason : null,
  });
  if (error) throw error;
  return (data as { result_status: string; resonance_id: string | null }[])[0];
}

export async function getResonances(): Promise<Resonance[]> {
  const { data, error } = await requireSupabase().rpc('get_my_resonances_v6');
  if (error) throw error;
  return (data ?? []) as Resonance[];
}

export async function respondToPhoto(resonanceId: string, interested: boolean) {
  const { data, error } = await requireSupabase().rpc('respond_to_photo_resonance', {
    p_resonance_id: resonanceId,
    p_interested: interested,
  });
  if (error) throw error;
  return (data as { result_status: string; opened_conversation_id: string | null }[])[0];
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await requireSupabase().rpc('get_my_inbox_v2');
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function getMessages(conversationId: string, before: string | null = null) {
  let query = requireSupabase().from('messages')
    .select('id, conversation_id, sender_id, body, message_type, media_path, deleted_for_everyone_at, created_at')
    .eq('conversation_id', conversationId).order('created_at', { ascending: false });
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query.limit(31);
  if (error) throw error;
  const rows = (data ?? []) as ChatMessage[];
  return { messages: rows.slice(0, 30).reverse(), hasMore: rows.length > 30 };
}

// Same contract as mobile: the actor comes from the JWT; the server moves only
// the caller's own read marker and rejects a conversation it is not part of.
export async function markConversationRead(conversationId: string) {
  const { error } = await requireSupabase().rpc('mark_conversation_read', { p_conversation_id: conversationId });
  if (error) throw error;
}

export async function sendMessage(conversationId: string, senderId: string, body: string, clientId: string) {
  const { error } = await requireSupabase().from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    message_type: 'text',
    client_message_id: clientId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function blockContact(contactId: string) {
  const { error } = await requireSupabase().rpc('block_user', { p_blocked_user_id: contactId });
  if (error) throw error;
}

export async function reportVoice(impressionId: string, category: string, details: string) {
  const { error } = await requireSupabase().rpc('report_dating_candidate', {
    p_impression_id: impressionId,
    p_category: category,
    p_details: details,
    p_block_user: true,
  });
  if (error) throw error;
}

export async function reportResonance(resonanceId: string) {
  const { error } = await requireSupabase().rpc('report_dating_resonance_content', {
    p_resonance_id: resonanceId,
    p_content_type: 'profile',
    p_content_reference: '',
  });
  if (error) throw error;
}

export async function reportConversation(contactId: string, conversationId: string, category: string, details: string) {
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
