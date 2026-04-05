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
}

export interface LeaderboardIndex {
  version: 1;
  updatedAt: string;
  total: number;
  entries: LeaderboardEntry[];
}

export type ChannelFilter = 'all' | 'claude' | 'gpt' | 'cursor' | 'deepseek' | 'gemini';

export const CHANNEL_FILTERS: { value: ChannelFilter; label: string; icon: string }[] = [
  { value: 'all', label: '全部', icon: '🌐' },
  { value: 'claude', label: 'Claude', icon: '🟠' },
  { value: 'gpt', label: 'GPT', icon: '🟢' },
  { value: 'cursor', label: 'Cursor', icon: '🟣' },
  { value: 'deepseek', label: 'DeepSeek', icon: '🔵' },
  { value: 'gemini', label: 'Gemini', icon: '🔴' },
];

export const RANK_TIER_BADGES: Record<string, { badge: string; label: string; accent: string }> = {
  starter:     { badge: '🪄', label: '新手', accent: '#94a3b8' },
  apprentice:  { badge: '⚡', label: '学徒', accent: '#eab308' },
  expert:      { badge: '🏅', label: '高手', accent: '#22c55e' },
  legend:      { badge: '🏆', label: '战神', accent: '#3b82f6' },
  mythic:      { badge: '👑', label: '传奇', accent: '#8b5cf6' },
  ultra:       { badge: '🚀', label: '超频', accent: '#ec4899' },
  singularity: { badge: '🌌', label: '奇点', accent: '#ef4444' },
};

export const CHANNEL_ICONS: Record<string, string> = {
  claude: '🟠', gpt: '🟢', cursor: '🟣',
  deepseek: '🔵', gemini: '🔴', other: '⚪',
};

export function filterByChannel(
  entries: readonly LeaderboardEntry[],
  channel: ChannelFilter
): LeaderboardEntry[] {
  if (channel === 'all') return [...entries];
  return entries.filter((e) => e.channel === channel);
}

export function getRankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export async function fetchLeaderboard(): Promise<LeaderboardIndex> {
  const res = await fetch('/api/leaderboard');
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}
