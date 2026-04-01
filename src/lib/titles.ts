// Title/rank calculation based on token consumption

export interface TitleInfo {
  title: string;
  titleEn: string;
  icon: string;
  color: string;
  glowColor: string;
  tier: number; // 1-7
}

export interface RankTierInfo {
  id: string;
  tier: number;
  badge: string;
  label: string;
  labelEn: string;
  clubLabel: string;
  clubLabelEn: string;
  accent: string;
  topPercentLabel: string;
  topPercentLabelEn: string;
}

const TITLES: TitleInfo[] = [
  {
    title: 'AI 点火者',
    titleEn: 'Spark Igniter',
    icon: '🔥',
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    tier: 1,
  },
  {
    title: '初学乍练',
    titleEn: 'First Steps',
    icon: '⚡',
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    tier: 2,
  },
  {
    title: '码力全开',
    titleEn: 'Full Throttle',
    icon: '💻',
    color: '#22c55e',
    glowColor: 'rgba(34, 197, 94, 0.4)',
    tier: 3,
  },
  {
    title: '算力牛马',
    titleEn: 'Compute Beast',
    icon: '🐂',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    tier: 4,
  },
  {
    title: '思维黑洞',
    titleEn: 'Mind Singularity',
    icon: '🕳️',
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.5)',
    tier: 5,
  },
  {
    title: '算法炼金师',
    titleEn: 'Algorithm Alchemist',
    icon: '⚗️',
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.5)',
    tier: 6,
  },
  {
    title: '奇点突破者',
    titleEn: 'Singularity Breaker',
    icon: '💥',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.6)',
    tier: 7,
  },
];

const RANK_TIERS: RankTierInfo[] = [
  {
    id: 'starter',
    tier: 1,
    badge: '🪄',
    label: '新手热身',
    labelEn: 'Warm-up',
    clubLabel: '起步用户',
    clubLabelEn: 'Getting Started',
    accent: '#94a3b8',
    topPercentLabel: 'Top 60%',
    topPercentLabelEn: 'Top 60%',
  },
  {
    id: 'apprentice',
    tier: 2,
    badge: '⚡',
    label: '学徒模式',
    labelEn: 'Apprentice',
    clubLabel: '百万练习生',
    clubLabelEn: '1M Apprentice',
    accent: '#eab308',
    topPercentLabel: 'Top 40%',
    topPercentLabelEn: 'Top 40%',
  },
  {
    id: 'expert',
    tier: 3,
    badge: '🏅',
    label: '高手局',
    labelEn: 'Expert',
    clubLabel: '千万俱乐部',
    clubLabelEn: '10M Club',
    accent: '#22c55e',
    topPercentLabel: 'Top 20%',
    topPercentLabelEn: 'Top 20%',
  },
  {
    id: 'legend',
    tier: 4,
    badge: '🏆',
    label: '战神档',
    labelEn: 'Legend',
    clubLabel: '亿级战神',
    clubLabelEn: '100M Legend',
    accent: '#3b82f6',
    topPercentLabel: 'Top 10%',
    topPercentLabelEn: 'Top 10%',
  },
  {
    id: 'mythic',
    tier: 5,
    badge: '👑',
    label: '传奇位',
    labelEn: 'Mythic',
    clubLabel: '十亿俱乐部',
    clubLabelEn: '1B+ Club',
    accent: '#8b5cf6',
    topPercentLabel: 'Top 5%',
    topPercentLabelEn: 'Top 5%',
  },
  {
    id: 'ultra',
    tier: 6,
    badge: '🚀',
    label: '超频位',
    labelEn: 'Ultra',
    clubLabel: '百亿超频组',
    clubLabelEn: '10B Hyper Club',
    accent: '#ec4899',
    topPercentLabel: 'Top 1%',
    topPercentLabelEn: 'Top 1%',
  },
  {
    id: 'singularity',
    tier: 7,
    badge: '🌌',
    label: '奇点位',
    labelEn: 'Singularity',
    clubLabel: '百亿以上神话',
    clubLabelEn: '100B Myth',
    accent: '#ef4444',
    topPercentLabel: 'Top 0.1%',
    topPercentLabelEn: 'Top 0.1%',
  },
];

export function calculateTitle(tokens: number): TitleInfo {
  if (tokens >= 100_000_000_000) return TITLES[6]; // 100B+
  if (tokens >= 10_000_000_000) return TITLES[5];   // 10B-100B
  if (tokens >= 1_000_000_000) return TITLES[4];     // 1B-10B
  if (tokens >= 100_000_000) return TITLES[3];       // 100M-1B
  if (tokens >= 10_000_000) return TITLES[2];        // 10M-100M
  if (tokens >= 1_000_000) return TITLES[1];         // 1M-10M
  return TITLES[0];                                   // < 1M
}

export function getRankTier(tokens: number): RankTierInfo {
  if (tokens >= 100_000_000_000) return RANK_TIERS[6];
  if (tokens >= 10_000_000_000) return RANK_TIERS[5];
  if (tokens >= 1_000_000_000) return RANK_TIERS[4];
  if (tokens >= 100_000_000) return RANK_TIERS[3];
  if (tokens >= 10_000_000) return RANK_TIERS[2];
  if (tokens >= 1_000_000) return RANK_TIERS[1];
  return RANK_TIERS[0];
}

// Style tags based on usage patterns
export interface StyleTag {
  label: string;
  labelEn: string;
  icon: string;
}

export const STYLE_TAGS: StyleTag[] = [
  { label: '夜枭型', labelEn: 'Night Owl', icon: '🦉' },
  { label: '深度思考者', labelEn: 'Deep Thinker', icon: '🧠' },
  { label: '代码偏执狂', labelEn: 'Code Addict', icon: '💻' },
  { label: '马拉松选手', labelEn: 'Marathon Runner', icon: '🏃' },
  { label: '多模型玩家', labelEn: 'Multi-Model Player', icon: '🎮' },
  { label: 'Vibe Coder', labelEn: 'Vibe Coder', icon: '🎵' },
  { label: '效率怪兽', labelEn: 'Efficiency Beast', icon: '⚡' },
  { label: '全栈战士', labelEn: 'Full Stack Warrior', icon: '🗡️' },
];

// Get random style tags (for self-report mode, user picks or we assign randomly)
export function getRandomTags(count: number = 2): StyleTag[] {
  const shuffled = [...STYLE_TAGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
