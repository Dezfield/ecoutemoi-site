import { requireSupabase } from '../lib/supabase';

/**
 * A link to a private recording (bucket dating-audio) comes from the
 * voice-media-link Edge function: the server checks access to the recording
 * and fixes the lifetime (300 s), whatever the client would ask for. Against a
 * backend without the function the web signs directly for the same 300 s;
 * once the backend closes direct signing of other people's audio, only the
 * function works.
 */
export const VOICE_LINK_FALLBACK_SECONDS = 300;

export async function voiceMediaLink(path: string): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('voice-media-link', { body: { paths: [path] } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status !== 404) throw error;
    const signed = await client.storage.from('dating-audio').createSignedUrl(path, VOICE_LINK_FALLBACK_SECONDS);
    if (signed.error) throw signed.error;
    return signed.data.signedUrl;
  }
  const item = (data as { items?: Array<{ path?: unknown; url?: unknown }> } | null)?.items?.find((entry) => entry.path === path);
  if (typeof item?.url !== 'string') throw new Error('Запись недоступна.');
  return item.url;
}
