export interface LeaderboardEntry {
  id: string;
  username: string;
  totalTokens: number;
  channel: string;
  avatarType: string;
  avatarValue: string;
  theme: string;
  projectCount: number;
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

export const CHANNEL_FILTERS: { value: ChannelFilter; label: string; icon: string }[] = [
  { value: 'all', label: '全部', icon: '🌐' },
  { value: 'claude', label: 'Claude', icon: '🟠' },
  { value: 'gpt', label: 'GPT', icon: '🟢' },
  { value: 'cursor', label: 'Cursor', icon: '🟣' },
  { value: 'deepseek', label: 'DeepSeek', icon: '🔵' },
  { value: 'gemini', label: 'Gemini', icon: '🔴' },
  { value: 'other', label: 'Other', icon: '⚪' },
];

export const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'month', label: '本月' },
  { value: 'week', label: '本周' },
];

export const FEATURED_REGIONS: { value: string; label: string; flag: string }[] = [
  { value: '', label: '全部地区', flag: '🌍' },
  { value: 'CN', label: '中国', flag: '🇨🇳' },
  { value: 'US', label: '美国', flag: '🇺🇸' },
  { value: 'JP', label: '日本', flag: '🇯🇵' },
  { value: 'SG', label: '新加坡', flag: '🇸🇬' },
  { value: 'GB', label: '英国', flag: '🇬🇧' },
  { value: 'DE', label: '德国', flag: '🇩🇪' },
  { value: 'IN', label: '印度', flag: '🇮🇳' },
];

export const RANK_TIER_BADGES: Record<string, { badge: string; label: string; accent: string }> = {
  starter: { badge: '🪄', label: '新手', accent: '#94a3b8' },
  apprentice: { badge: '⚡', label: '学徒', accent: '#eab308' },
  expert: { badge: '🏅', label: '高手', accent: '#22c55e' },
  legend: { badge: '🏆', label: '战神', accent: '#3b82f6' },
  mythic: { badge: '👑', label: '传奇', accent: '#8b5cf6' },
  ultra: { badge: '🚀', label: '超频', accent: '#ec4899' },
  singularity: { badge: '🌌', label: '奇点', accent: '#ef4444' },
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

export function getRegionLabel(region?: string): string {
  const normalized = (region || '').toUpperCase();
  const matched = FEATURED_REGIONS.find((item) => item.value === normalized);
  return matched?.label ?? (normalized || '未知地区');
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
