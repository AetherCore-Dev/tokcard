export interface LeaderboardEntry {
  id: string;
  username: string;
  totalTokens: number;
  channel: string;
  avatarType: string;
  avatarValue: string;
  theme: string;
  projectCount: number;
  topProject?: {
    name: string;
    url: string;
    icon: string;
  };
  topModel: string;
  rankTierId: string;
  createdAt: string;
  region?: string;
  company?: string;
}

export interface LeaderboardMeta {
  offset: number;
  limit: number;
  page: number;
  hasMore: boolean;
  companySuggestions: string[];
  topCompanies: Array<{ name: string; count: number }>;
}

export interface LeaderboardIndex {
  version: 1;
  updatedAt: string;
  total: number;
  entries: LeaderboardEntry[];
  meta?: LeaderboardMeta;
}

export type ChannelFilter = 'all' | 'claude' | 'gpt' | 'cursor' | 'deepseek' | 'gemini' | 'other';
export type TimeFilter = 'all' | 'week' | 'month';

export interface LeaderboardFilters {
  channel?: ChannelFilter;
  region?: string;
  company?: string;
  time?: TimeFilter;
  page?: number;
  limit?: number;
  focus?: string;
}

export const CHANNEL_FILTERS: { value: ChannelFilter; labelZh: string; labelEn: string; icon: string }[] = [
  { value: 'all', labelZh: '全部', labelEn: 'All', icon: '🌐' },
  { value: 'claude', labelZh: 'Claude', labelEn: 'Claude', icon: '🟠' },
  { value: 'gpt', labelZh: 'GPT', labelEn: 'GPT', icon: '🟢' },
  { value: 'cursor', labelZh: 'Cursor', labelEn: 'Cursor', icon: '🟣' },
  { value: 'deepseek', labelZh: 'DeepSeek', labelEn: 'DeepSeek', icon: '🔵' },
  { value: 'gemini', labelZh: 'Gemini', labelEn: 'Gemini', icon: '🔴' },
  { value: 'other', labelZh: '其他', labelEn: 'Other', icon: '⚪' },
];

export const TIME_FILTERS: { value: TimeFilter; labelZh: string; labelEn: string }[] = [
  { value: 'all', labelZh: '全部', labelEn: 'All' },
  { value: 'month', labelZh: '本月', labelEn: 'Month' },
  { value: 'week', labelZh: '本周', labelEn: 'Week' },
];

export const FEATURED_REGIONS: { value: string; label: string; labelEn: string; flag: string }[] = [
  { value: '', label: '全部地区', labelEn: 'All regions', flag: '🌍' },
  { value: 'CN', label: '中国', labelEn: 'China', flag: '🇨🇳' },
  { value: 'US', label: '美国', labelEn: 'United States', flag: '🇺🇸' },
  { value: 'JP', label: '日本', labelEn: 'Japan', flag: '🇯🇵' },
  { value: 'SG', label: '新加坡', labelEn: 'Singapore', flag: '🇸🇬' },
  { value: 'GB', label: '英国', labelEn: 'United Kingdom', flag: '🇬🇧' },
  { value: 'DE', label: '德国', labelEn: 'Germany', flag: '🇩🇪' },
  { value: 'IN', label: '印度', labelEn: 'India', flag: '🇮🇳' },
];

export const RANK_TIER_BADGES: Record<string, { badge: string; label: string; labelEn: string; accent: string }> = {
  starter: { badge: '🪄', label: '新手', labelEn: 'Starter', accent: '#94a3b8' },
  apprentice: { badge: '⚡', label: '学徒', labelEn: 'Apprentice', accent: '#eab308' },
  expert: { badge: '🏅', label: '高手', labelEn: 'Expert', accent: '#22c55e' },
  legend: { badge: '🏆', label: '战神', labelEn: 'Legend', accent: '#3b82f6' },
  mythic: { badge: '👑', label: '传奇', labelEn: 'Mythic', accent: '#8b5cf6' },
  ultra: { badge: '🚀', label: '超频', labelEn: 'Ultra', accent: '#ec4899' },
  singularity: { badge: '🌌', label: '奇点', labelEn: 'Singularity', accent: '#ef4444' },
};

export const CHANNEL_ICONS: Record<string, string> = {
  claude: '🟠',
  gpt: '🟢',
  cursor: '🟣',
  deepseek: '🔵',
  gemini: '🔴',
  other: '⚪',
};

export function getRankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export function getRegionFlag(region?: string): string {
  const matched = FEATURED_REGIONS.find((item) => item.value === (region || '').toUpperCase());
  return matched?.flag ?? '🌍';
}

export function getRegionLabel(region?: string, isZh = true): string {
  const normalized = (region || '').toUpperCase();
  const matched = FEATURED_REGIONS.find((item) => item.value === normalized);
  return isZh
    ? (matched?.label ?? (normalized || '未知地区'))
    : (matched?.labelEn ?? (normalized || 'Unknown region'));
}

export async function fetchLeaderboard(filters: LeaderboardFilters = {}): Promise<LeaderboardIndex> {
  const params = new URLSearchParams();

  if (filters.channel && filters.channel !== 'all') params.set('channel', filters.channel);
  if (filters.region) params.set('region', filters.region);
  if (filters.company?.trim()) params.set('company', filters.company.trim());
  if (filters.time && filters.time !== 'all') params.set('time', filters.time);
  if (filters.page && filters.page > 0) params.set('page', String(filters.page));
  if (filters.limit && filters.limit > 0) params.set('limit', String(filters.limit));
  if (filters.focus) params.set('focus', filters.focus);

  const query = params.toString();
  const res = await fetch(`/api/leaderboard${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}
