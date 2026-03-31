// Card data structure
export interface CardData {
  username: string;
  avatarType: 'photo' | 'emoji' | 'github' | 'cartoon';
  avatarValue: string; // URL, emoji char, github username, or dicebear seed
  slogan: string;
  customMetaphor: string;
  totalTokens: number;
  channel: 'claude' | 'gpt' | 'cursor' | 'deepseek' | 'gemini' | 'other';
  theme:
    | 'brand-dark'
    | 'brand-light'
    | 'bold-violet'
    | 'mono-brutal'
    | 'terminal-green'
    | 'cyberpunk-neon'
    | 'gradient-dream'
    | 'sunset-warm'
    | 'ocean-blue'
    | 'minimal-gray';
  backgroundType: 'none' | 'preset' | 'custom';
  backgroundValue: string;
  modelBreakdown: ModelBreakdown[];
  qrcodeUrl: string;
  platform: PlatformKey;
  metaphorCategory: 'meme' | 'flex' | 'shock' | 'selfMock' | 'scifi' | 'worker';
  locale: 'zh' | 'en';
}

export interface ModelBreakdown {
  name: string;
  percentage: number;
  color: string;
}

export type PlatformKey = 'wechat' | 'twitter' | 'instagram' | 'weibo' | 'xiaohongshu' | 'linkedin';

export interface PlatformConfig {
  key: PlatformKey;
  label: string;
  labelZh: string;
  width: number;
  height: number;
  ratio: string;
}

interface SharedCardPayloadV1 {
  v: 1;
  u: string;
  at: CardData['avatarType'];
  av: string;
  s: string;
  m: string;
  t: number;
  c: CardData['channel'];
  th: CardData['theme'];
  bgT: CardData['backgroundType'];
  bgV: string;
  mb: ModelBreakdown[];
  mc: CardData['metaphorCategory'];
  l: CardData['locale'];
  p: CardData['platform'];
  link: string;
}

interface CardTemplatePresetV1 {
  v: 1;
  at: CardData['avatarType'];
  av: string;
  c: CardData['channel'];
  th: CardData['theme'];
  bgT: CardData['backgroundType'];
  bgV: string;
  mb: ModelBreakdown[];
  mc: CardData['metaphorCategory'];
  l: CardData['locale'];
  p: CardData['platform'];
}

export interface DecodedSharedCard {
  card: CardData;
  targetUrl: string;
}

export const PLATFORMS: Record<PlatformKey, PlatformConfig> = {
  wechat: { key: 'wechat', label: 'WeChat Moments', labelZh: '微信朋友圈', width: 1080, height: 1440, ratio: '3:4' },
  twitter: { key: 'twitter', label: 'X / Twitter', labelZh: 'X / Twitter', width: 1200, height: 675, ratio: '16:9' },
  instagram: { key: 'instagram', label: 'Instagram Story', labelZh: 'Instagram Story', width: 1080, height: 1920, ratio: '9:16' },
  weibo: { key: 'weibo', label: 'Weibo', labelZh: '微博', width: 1080, height: 1080, ratio: '1:1' },
  xiaohongshu: { key: 'xiaohongshu', label: 'Xiaohongshu', labelZh: '小红书', width: 1080, height: 1440, ratio: '3:4' },
  linkedin: { key: 'linkedin', label: 'LinkedIn', labelZh: 'LinkedIn', width: 1200, height: 627, ratio: '1.9:1' },
};

export const CHANNELS = [
  { value: 'claude', label: 'Claude (Anthropic)', color: '#d97706' },
  { value: 'gpt', label: 'GPT (OpenAI)', color: '#10b981' },
  { value: 'cursor', label: 'Cursor', color: '#6529c4' },
  { value: 'deepseek', label: 'DeepSeek', color: '#1652f0' },
  { value: 'gemini', label: 'Gemini (Google)', color: '#ef4444' },
  { value: 'other', label: 'Other / Mixed', color: '#6b7280' },
] as const;

export const PRESET_BACKGROUNDS = [
  { value: '/images/backgrounds/neon-circuit.jpg', label: 'Neon Circuit', labelZh: '霓虹电路' },
  { value: '/images/backgrounds/neon-nebula.jpg', label: 'Neon Nebula', labelZh: '霓虹星云' },
  { value: '/images/backgrounds/neon-orbs.jpg', label: 'Neon Orbs', labelZh: '霓虹光球' },
] as const;

export const DEFAULT_CARD_DATA: CardData = {
  username: '',
  avatarType: 'emoji',
  avatarValue: '🤖',
  slogan: 'Build with AI, ship like a factory',
  customMetaphor: '',
  totalTokens: 0,
  channel: 'claude',
  theme: 'brand-light',
  backgroundType: 'none',
  backgroundValue: '',
  modelBreakdown: [
    { name: 'Claude', percentage: 70, color: '#d97706' },
    { name: 'GPT', percentage: 30, color: '#10b981' },
  ],
  qrcodeUrl: '',
  platform: 'wechat',
  metaphorCategory: 'flex',
  locale: 'zh',
};

// Format token number with commas
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

export function formatTokensFull(tokens: number): string {
  return tokens.toLocaleString();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getShareSafeAvatar(data: CardData): Pick<CardData, 'avatarType' | 'avatarValue'> {
  if (data.avatarType === 'photo' && data.avatarValue.startsWith('data:image')) {
    return { avatarType: 'emoji', avatarValue: '🤖' };
  }

  return {
    avatarType: data.avatarType,
    avatarValue: data.avatarValue || '🤖',
  };
}

function getShareSafeBackground(data: CardData): Pick<CardData, 'backgroundType' | 'backgroundValue'> {
  if (data.backgroundType === 'custom') {
    return { backgroundType: 'none', backgroundValue: '' };
  }

  return {
    backgroundType: data.backgroundType,
    backgroundValue: data.backgroundValue,
  };
}

export function encodeSharedCardPayload(data: CardData): string | null {
  if (!data.qrcodeUrl.trim()) {
    return null;
  }

  const avatar = getShareSafeAvatar(data);
  const background = getShareSafeBackground(data);

  const payload: SharedCardPayloadV1 = {
    v: 1,
    u: data.username,
    at: avatar.avatarType,
    av: avatar.avatarValue,
    s: data.slogan,
    m: data.customMetaphor,
    t: data.totalTokens,
    c: data.channel,
    th: data.theme,
    bgT: background.backgroundType,
    bgV: background.backgroundValue,
    mb: data.modelBreakdown,
    mc: data.metaphorCategory,
    l: data.locale,
    p: data.platform,
    link: data.qrcodeUrl.trim(),
  };

  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeSharedCardPayload(value: string): DecodedSharedCard | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(value));
    const payload = JSON.parse(json) as Partial<SharedCardPayloadV1>;

    if (payload.v !== 1 || !payload.link) {
      return null;
    }

    return {
      card: {
        ...DEFAULT_CARD_DATA,
        username: payload.u ?? DEFAULT_CARD_DATA.username,
        avatarType: payload.at ?? DEFAULT_CARD_DATA.avatarType,
        avatarValue: payload.av ?? DEFAULT_CARD_DATA.avatarValue,
        slogan: payload.s ?? DEFAULT_CARD_DATA.slogan,
        customMetaphor: payload.m ?? DEFAULT_CARD_DATA.customMetaphor,
        totalTokens: payload.t ?? DEFAULT_CARD_DATA.totalTokens,
        channel: payload.c ?? DEFAULT_CARD_DATA.channel,
        theme: payload.th ?? DEFAULT_CARD_DATA.theme,
        backgroundType: payload.bgT ?? DEFAULT_CARD_DATA.backgroundType,
        backgroundValue: payload.bgV ?? DEFAULT_CARD_DATA.backgroundValue,
        modelBreakdown: payload.mb?.length ? payload.mb : DEFAULT_CARD_DATA.modelBreakdown,
        qrcodeUrl: '',
        platform: payload.p ?? DEFAULT_CARD_DATA.platform,
        metaphorCategory: payload.mc ?? DEFAULT_CARD_DATA.metaphorCategory,
        locale: payload.l ?? DEFAULT_CARD_DATA.locale,
      },
      targetUrl: payload.link,
    };
  } catch {
    return null;
  }
}

export function buildSharedCardUrl(data: CardData, origin: string): string | null {
  const encoded = encodeSharedCardPayload(data);
  if (!encoded) {
    return null;
  }

  return `${origin.replace(/\/$/, '')}/u?d=${encoded}`;
}

export function encodeCardTemplatePreset(data: CardData): string {
  const avatar = getShareSafeAvatar(data);
  const background = getShareSafeBackground(data);

  const preset: CardTemplatePresetV1 = {
    v: 1,
    at: avatar.avatarType,
    av: avatar.avatarValue,
    c: data.channel,
    th: data.theme,
    bgT: background.backgroundType,
    bgV: background.backgroundValue,
    mb: data.modelBreakdown,
    mc: data.metaphorCategory,
    l: data.locale,
    p: data.platform,
  };

  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(preset)));
}

export function decodeCardTemplatePreset(value: string): Partial<CardData> | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(value));
    const preset = JSON.parse(json) as Partial<CardTemplatePresetV1>;

    if (preset.v !== 1) {
      return null;
    }

    return {
      ...DEFAULT_CARD_DATA,
      username: '',
      slogan: '',
      customMetaphor: '',
      totalTokens: 0,
      qrcodeUrl: '',
      avatarType: preset.at ?? DEFAULT_CARD_DATA.avatarType,
      avatarValue: preset.av ?? DEFAULT_CARD_DATA.avatarValue,
      channel: preset.c ?? DEFAULT_CARD_DATA.channel,
      theme: preset.th ?? DEFAULT_CARD_DATA.theme,
      backgroundType: preset.bgT ?? DEFAULT_CARD_DATA.backgroundType,
      backgroundValue: preset.bgV ?? DEFAULT_CARD_DATA.backgroundValue,
      modelBreakdown: preset.mb?.length ? preset.mb : DEFAULT_CARD_DATA.modelBreakdown,
      metaphorCategory: preset.mc ?? DEFAULT_CARD_DATA.metaphorCategory,
      locale: preset.l ?? DEFAULT_CARD_DATA.locale,
      platform: preset.p ?? DEFAULT_CARD_DATA.platform,
    };
  } catch {
    return null;
  }
}

export function buildCreateFromTemplateUrl(data: CardData, origin: string): string {
  const encoded = encodeCardTemplatePreset(data);
  return `${origin.replace(/\/$/, '')}/create?p=${encoded}`;
}
