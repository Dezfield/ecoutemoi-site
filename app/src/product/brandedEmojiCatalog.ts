// The branded emoji catalogue: keys, labels and motions, and nothing else.
// It imports nothing at all — no service, no React Native, no PNG assets — so
// both the asset layer and the chat service can depend on it, and plain node
// can evaluate it.

export type CloudBrandedEmojiKey =
  | 'emoji_happy'
  | 'emoji_laugh'
  | 'emoji_love'
  | 'emoji_wink'
  | 'emoji_wow'
  | 'emoji_sad'
  | 'emoji_angry'
  | 'emoji_thinking'
  | 'emoji_excited';

export type BrandedEmojiMotion = 'bounce' | 'laugh' | 'heartbeat' | 'wink' | 'pop' | 'droop' | 'shake' | 'think' | 'celebrate';

export type BrandedEmojiInfo = {
  key: CloudBrandedEmojiKey;
  label: string;
  motion: BrandedEmojiMotion;
};

/** The single source of truth for which branded emoji exist and how they read. */
export const brandedEmojiCatalog: BrandedEmojiInfo[] = [
  { key: 'emoji_happy', label: 'Радость', motion: 'bounce' },
  { key: 'emoji_laugh', label: 'Смешно', motion: 'laugh' },
  { key: 'emoji_love', label: 'Влюблённость', motion: 'heartbeat' },
  { key: 'emoji_wink', label: 'Подмигивание', motion: 'wink' },
  { key: 'emoji_wow', label: 'Ого', motion: 'pop' },
  { key: 'emoji_sad', label: 'Сочувствие', motion: 'droop' },
  { key: 'emoji_angry', label: 'Сердитый', motion: 'shake' },
  { key: 'emoji_thinking', label: 'Думаю', motion: 'think' },
  { key: 'emoji_excited', label: 'Ура', motion: 'celebrate' },
];

export function brandedEmojiInfoFromMessageBody(body: string) {
  if (!body.startsWith('emoji:')) return null;
  const key = body.slice('emoji:'.length) as CloudBrandedEmojiKey;
  return brandedEmojiCatalog.find((emoji) => emoji.key === key) ?? null;
}

export function brandedEmojiMessageBody(key: CloudBrandedEmojiKey) {
  return `emoji:${key}`;
}
