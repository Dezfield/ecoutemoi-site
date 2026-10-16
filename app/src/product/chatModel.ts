import type { ChatMessage } from './api';
import type { Reaction } from './chat';
export function visibleMessage(message: ChatMessage, now = Date.now()) {
  return !message.deleted_for_everyone_at && (!message.expires_at || Date.parse(message.expires_at) > now);
}
export function momentTimeline(messages: ChatMessage[], summaries: Reaction[], now = Date.now()) {
  const visible = messages
    .filter((m) => visibleMessage(m, now))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const events: { id: string; title: string; message: ChatMessage }[] = [];
  for (const [kind, title] of [
    ['voice', 'Первый голос'],
    ['image', 'Первая фотография'],
    ['meeting', 'Предложение встречи'],
  ] as const) {
    const message = visible.find((m) => m.message_type === kind);
    if (message) events.push({ id: `${kind}-${message.id}`, title, message });
  }
  const firstReaction = visible.find((m) =>
    summaries.some((r) => r.message_id === m.id && Number(r.reaction_count) > 0),
  );
  if (firstReaction)
    events.push({ id: `reaction-${firstReaction.id}`, title: 'Первый отклик', message: firstReaction });
  for (const message of visible.filter((m) => m.message_type === 'moment'))
    events.push({ id: `moment-${message.id}`, title: 'Момент', message });
  return events.sort(
    (a, b) => a.message.created_at.localeCompare(b.message.created_at) || a.id.localeCompare(b.id),
  );
}
