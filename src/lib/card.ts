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
