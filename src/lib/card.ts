import type { RankTierInfo } from '@/lib/titles';
import { validateUrl, validateHexColor } from '@/lib/url';

// Card data structure
export interface FeaturedProject {
  id: string;
  name: string;
  icon: string;
  url: string;
  displayType: 'icon' | 'icon+text';
}

export type TrustTier = 'self-reported' | 'screenshot-backed' | 'usage-imported' | 'strong-authenticated';
export type ProofSource = 'claude' | 'cursor' | 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'other';
export type CardTheme = 'brand-dark' | 'brand-light' | 'minimal-gray';

const LEGACY_THEME_MAP: Record<string, CardTheme> = {
  'bold-violet': 'brand-dark',
  'mono-brutal': 'minimal-gray',
  'terminal-green': 'brand-dark',
  'cyberpunk-neon': 'brand-dark',
  'gradient-dream': 'brand-light',
  'sunset-warm': 'brand-light',
  'ocean-blue': 'brand-light',
};

export interface ProofDateRange {
  start?: string;
  end?: string;
}

export interface CardData {
  username: string;
  avatarType: 'photo' | 'emoji' | 'github' | 'cartoon';
  avatarValue: string; // URL, emoji char, github username, or dicebear seed
  slogan: string;
  customMetaphor: string;
  totalTokens: number;
  lastMonthTokens: number;
  channel: 'claude' | 'gpt' | 'cursor' | 'deepseek' | 'gemini' | 'other';
  region?: string;
  company?: string;
  createdAt?: string;
  theme: CardTheme;
  backgroundType: 'none' | 'preset' | 'custom';
  backgroundValue: string;
  modelBreakdown: ModelBreakdown[];
  qrcodeUrl: string;
  platform: PlatformKey;
  metaphorCategory: 'meme' | 'flex' | 'shock' | 'selfMock' | 'scifi' | 'worker';
  locale: 'zh' | 'en';
  projects: FeaturedProject[];
  primaryProjectName: string;
  primaryProjectUrl: string;
  primaryProjectPitch: string;
  referralCode: string;
  trustTier: TrustTier;
  proofSource?: ProofSource;
  proofDateRange?: ProofDateRange;
  importedAt?: string;
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
  lt?: number;
  c: CardData['channel'];
  reg?: string;
  org?: string;
  ca?: string;
  th: CardData['theme'];
  bgT: CardData['backgroundType'];
  bgV: string;
  mb: ModelBreakdown[];
  mc: CardData['metaphorCategory'];
  l: CardData['locale'];
  p: CardData['platform'];
  link: string;
  pr?: FeaturedProject[];
  ppn?: string; // primaryProjectName
  ppu?: string; // primaryProjectUrl
  ppp?: string; // primaryProjectPitch
  ref?: string;
  tr?: TrustTier;
  ps?: ProofSource;
  pds?: string;
  pde?: string;
  iat?: string;
}

interface CardTemplatePresetV1 {
  v: 1;
  at: CardData['avatarType'];
  av: string;
  c: CardData['channel'];
  reg?: string;
  org?: string;
  th: CardData['theme'];
  bgT: CardData['backgroundType'];
  bgV: string;
  mb: ModelBreakdown[];
  mc: CardData['metaphorCategory'];
  l: CardData['locale'];
  p: CardData['platform'];
  pr?: FeaturedProject[];
  ppn?: string; // primaryProjectName
  ppu?: string; // primaryProjectUrl
  ppp?: string; // primaryProjectPitch
}

export interface DecodedSharedCard {
  card: CardData;
  targetUrl: string;
  referralCode: string;
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
  { value: '#0f172a', label: 'Night Ink', labelZh: '深夜墨蓝', preview: '#0f172a' },
  { value: '#111827', label: 'Builder Black', labelZh: '极客曜黑', preview: '#111827' },
  { value: '#f8fafc', label: 'Soft Paper', labelZh: '柔雾白', preview: '#f8fafc' },
  { value: '#e0f2fe', label: 'Ice Blue', labelZh: '冰川浅蓝', preview: '#e0f2fe' },
  { value: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)', label: 'Midnight Signal', labelZh: '午夜信号', preview: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)' },
  { value: 'linear-gradient(135deg, #312e81 0%, #7c3aed 100%)', label: 'Violet Rush', labelZh: '电光紫雾', preview: 'linear-gradient(135deg, #312e81 0%, #7c3aed 100%)' },
  { value: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', label: 'Teal Flow', labelZh: '青潮渐变', preview: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)' },
  { value: 'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)', label: 'Amber Heat', labelZh: '暖焰橙金', preview: 'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)' },
] as const;

export const FEATURED_PROJECT_LIMIT = 3;

export const TRUST_TIER_META: Record<TrustTier, {
  label: string;
  labelZh: string;
  description: string;
  descriptionZh: string;
  accent: string;
}> = {
  'self-reported': {
    label: 'Self reported',
    labelZh: '用户填写',
    description: 'Ready to share now. It shows a tier signal first, and you can enter official rankings after adding a screenshot or importing usage records.',
    descriptionZh: '适合先发先传播。当前先展示档位信号；补 usage 截图或导入 usage 记录后，就能进入正式排名。',
    accent: '#64748b',
  },
  'screenshot-backed': {
    label: 'Proof attached',
    labelZh: '截图佐证',
    description: 'Backed by a usage or billing screenshot. It can enter percentile-style comparison now, and imported usage unlocks clearer ranking positions.',
    descriptionZh: '已附 usage 或账单截图。现在可以进入区间比较 / 百分位展示；继续导入 usage 记录后，能获得更明确的排名位置。',
    accent: '#0ea5e9',
  },
  'usage-imported': {
    label: 'Usage imported',
    labelZh: '数据导入',
    description: 'Imported from usage text or dashboard summaries. This state is eligible for official rankings and focused leaderboard views.',
    descriptionZh: '已导入 usage 文本或摘要，可进入正式排名，并支持排行榜聚焦查看。',
    accent: '#f59e0b',
  },
  'strong-authenticated': {
    label: 'Verified source',
    labelZh: '官方验证',
    description: 'Reserved for future direct source integrations with the strongest ranking presentation.',
    descriptionZh: '预留给未来更强的官方数据接入，可获得最高等级的排名展示。',
    accent: '#8b5cf6',
  },
};

export const PROOF_SOURCE_META: Record<ProofSource, { label: string; labelZh: string }> = {
  claude: { label: 'Claude', labelZh: 'Claude' },
  cursor: { label: 'Cursor', labelZh: 'Cursor' },
  openrouter: { label: 'OpenRouter', labelZh: 'OpenRouter' },
  openai: { label: 'OpenAI', labelZh: 'OpenAI' },
  anthropic: { label: 'Anthropic', labelZh: 'Anthropic' },
  gemini: { label: 'Gemini', labelZh: 'Gemini' },
  deepseek: { label: 'DeepSeek', labelZh: 'DeepSeek' },
  other: { label: 'Other source', labelZh: '其他来源' },
};

const TRUST_TIER_VALUES: TrustTier[] = ['self-reported', 'screenshot-backed', 'usage-imported', 'strong-authenticated'];
const PROOF_SOURCE_VALUES: ProofSource[] = ['claude', 'cursor', 'openrouter', 'openai', 'anthropic', 'gemini', 'deepseek', 'other'];
const CARD_THEME_VALUES: CardTheme[] = ['brand-dark', 'brand-light', 'minimal-gray'];

export function normalizeTrustTier(value?: string): TrustTier {
  return TRUST_TIER_VALUES.includes(value as TrustTier) ? (value as TrustTier) : 'self-reported';
}

export function normalizeProofSource(value?: string): ProofSource | undefined {
  return PROOF_SOURCE_VALUES.includes(value as ProofSource) ? (value as ProofSource) : undefined;
}

export function normalizeTheme(value?: unknown): CardTheme {
  if (typeof value !== 'string') return DEFAULT_CARD_DATA.theme;
  if (CARD_THEME_VALUES.includes(value as CardTheme)) return value as CardTheme;
  return LEGACY_THEME_MAP[value] ?? DEFAULT_CARD_DATA.theme;
}

export function getTrustTierLabel(tier: TrustTier, locale: 'zh' | 'en'): string {
  const meta = TRUST_TIER_META[tier];
  return locale === 'zh' ? meta.labelZh : meta.label;
}

export function getTrustTierDescription(tier: TrustTier, locale: 'zh' | 'en'): string {
  const meta = TRUST_TIER_META[tier];
  return locale === 'zh' ? meta.descriptionZh : meta.description;
}

export function getTrustTierAccent(tier: TrustTier): string {
  return TRUST_TIER_META[tier].accent;
}

export function getProofSourceLabel(source: ProofSource | undefined, locale: 'zh' | 'en'): string {
  if (!source) return locale === 'zh' ? '未指定来源' : 'Source not specified';
  const meta = PROOF_SOURCE_META[source];
  return locale === 'zh' ? meta.labelZh : meta.label;
}

export function canParticipateInRanking(tier: TrustTier): boolean {
  return tier !== 'self-reported';
}

export function getMaxRankingDisplay(tier: TrustTier): 'exact' | 'range' | 'hidden' {
  if (tier === 'usage-imported' || tier === 'strong-authenticated') return 'exact';
  if (tier === 'screenshot-backed') return 'range';
  return 'hidden';
}

export function getRankingSignalLabel(rankTier: RankTierInfo, trustTier: TrustTier, locale: 'zh' | 'en'): string {
  if (trustTier === 'self-reported') {
    return locale === 'zh' ? '档位参考' : 'Tier signal';
  }

  if (trustTier === 'screenshot-backed') {
    return locale === 'zh' ? `约 ${rankTier.topPercentLabel}` : `Approx. ${rankTier.topPercentLabelEn}`;
  }

  return locale === 'zh' ? `${rankTier.topPercentLabel} 区间` : `${rankTier.topPercentLabelEn} bracket`;
}

export function getRankingSignalDescription(rankTier: RankTierInfo, trustTier: TrustTier, locale: 'zh' | 'en'): string {
  if (trustTier === 'self-reported') {
    return locale === 'zh'
      ? `当前只展示 ${rankTier.label} 档位。想进入正式排名，请补 usage 截图或导入 usage 记录。`
      : `Currently shown as a ${rankTier.labelEn} tier signal. Add a screenshot or import usage records to enter official rankings.`;
  }

  if (trustTier === 'screenshot-backed') {
    return locale === 'zh'
      ? `基于截图佐证，已可用于 ${rankTier.topPercentLabel} 的区间比较；继续导入 usage 记录后，可获得更明确的排名位置。`
      : `Screenshot-backed and eligible for ${rankTier.topPercentLabelEn} range-style comparison. Import usage records next for clearer ranking positions.`;
  }

  return locale === 'zh'
    ? `当前已具备正式排名资格，可进入 ${rankTier.topPercentLabel} 区间并被排行榜聚焦查看。`
    : `This state is eligible for official rankings and can appear in the ${rankTier.topPercentLabelEn} bracket with focused leaderboard views.`;
}

export function formatProofDateRange(range: ProofDateRange | undefined, locale: 'zh' | 'en'): string {
  if (!range?.start && !range?.end) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formatDate = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatter.format(parsed);
  };

  const start = formatDate(range.start);
  const end = formatDate(range.end);

  if (start && end) {
    return `${start} → ${end}`;
  }

  return start || end;
}

export function parseTokenValue(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, '').replace(/tokens?/gi, '').trim();
  if (cleaned === '') return 0;

  let num = 0;
  if (/^\d+(\.\d+)?[bB亿]$/i.test(cleaned)) {
    num = parseFloat(cleaned) * 1_000_000_000;
  } else if (/^\d+(\.\d+)?[mM百万wW万]$/i.test(cleaned)) {
    if (cleaned.endsWith('万') || cleaned.toLowerCase().endsWith('w')) {
      num = parseFloat(cleaned) * 10_000;
    } else {
      num = parseFloat(cleaned) * 1_000_000;
    }
  } else if (/^\d+(\.\d+)?[kK]$/i.test(cleaned)) {
    num = parseFloat(cleaned) * 1_000;
  } else {
    num = parseFloat(cleaned) || 0;
  }

  if (Number.isNaN(num) || num < 0) return 0;
  return Math.round(num);
}

export const DEFAULT_CARD_DATA: CardData = {
  username: '',
  avatarType: 'emoji',
  avatarValue: '🤖',
  slogan: 'Build with AI, ship like a factory',
  customMetaphor: '',
  totalTokens: 0,
  lastMonthTokens: 0,
  channel: 'claude',
  region: '',
  company: '',
  createdAt: undefined,
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
  projects: [],
  primaryProjectName: '',
  primaryProjectUrl: '',
  primaryProjectPitch: '',
  referralCode: '',
  trustTier: 'self-reported',
};

function stripTrailingZero(value: string): string {
  return value.replace(/\.0$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function formatCompactValue(value: number): string {
  if (value >= 100) return Math.round(value).toString();
  if (value >= 10) return stripTrailingZero(value.toFixed(1));
  return stripTrailingZero(value.toFixed(1));
}

export function formatTokens(tokens: number, locale: 'zh' | 'en' = 'en'): string {
  if (locale === 'zh') {
    if (tokens >= 100_000_000) {
      return `${formatCompactValue(tokens / 100_000_000)}亿`;
    }
    if (tokens >= 10_000) {
      return `${formatCompactValue(tokens / 10_000)}万`;
    }
    return tokens.toLocaleString('zh-CN');
  }

  if (tokens >= 1_000_000_000) {
    return `${formatCompactValue(tokens / 1_000_000_000)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${formatCompactValue(tokens / 1_000_000)}M`;
  }
  if (tokens >= 1_000) {
    return `${formatCompactValue(tokens / 1_000)}K`;
  }
  return tokens.toLocaleString('en-US');
}

export function formatTokensFull(tokens: number, locale: 'zh' | 'en' = 'en'): string {
  return tokens.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}

const TOKEN_COST_PER_MILLION_USD = 4;
const USD_TO_CNY = 7.2;

export function estimateTokenValueUSD(tokens: number): number {
  return (tokens / 1_000_000) * TOKEN_COST_PER_MILLION_USD;
}

export function estimateTokenValueCNY(tokens: number): number {
  return estimateTokenValueUSD(tokens) * USD_TO_CNY;
}

function formatCurrencyCompact(amount: number, currency: 'USD' | 'CNY', locale: 'zh' | 'en'): string {
  const prefix = currency === 'USD' ? '$' : locale === 'zh' ? '¥' : 'CN¥';

  if (locale === 'zh' && currency === 'CNY') {
    if (amount >= 100_000_000) {
      return `${prefix}${formatCompactValue(amount / 100_000_000)}亿`;
    }
    if (amount >= 10_000) {
      return `${prefix}${formatCompactValue(amount / 10_000)}万`;
    }
    return `${prefix}${amount.toLocaleString('zh-CN', { maximumFractionDigits: amount >= 100 ? 0 : 1 })}`;
  }

  if (amount >= 1_000_000_000) {
    return `${prefix}${formatCompactValue(amount / 1_000_000_000)}B`;
  }
  if (amount >= 1_000_000) {
    return `${prefix}${formatCompactValue(amount / 1_000_000)}M`;
  }
  if (amount >= 1_000) {
    return `${prefix}${formatCompactValue(amount / 1_000)}K`;
  }
  if (amount >= 100) {
    return `${prefix}${Math.round(amount).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}`;
  }
  return `${prefix}${stripTrailingZero(amount.toFixed(amount >= 10 ? 1 : 2))}`;
}

export function formatTokenValueEstimate(tokens: number, locale: 'zh' | 'en' = 'en'): string {
  if (tokens <= 0) return locale === 'zh' ? '≈ $0 / ¥0' : '≈ $0 / CN¥0';

  const usd = estimateTokenValueUSD(tokens);
  const cny = estimateTokenValueCNY(tokens);
  return `${formatCurrencyCompact(usd, 'USD', locale)} / ${formatCurrencyCompact(cny, 'CNY', locale)}`;
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

export function sanitizeReferralCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function normalizeRegion(value?: string): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
}

export function normalizeCompany(value?: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

export function normalizeFeaturedProjects(projects: FeaturedProject[]): FeaturedProject[] {
  return projects
    .slice(0, FEATURED_PROJECT_LIMIT)
    .map<FeaturedProject>((project, index) => ({
      id: project.id?.trim() || `project-${index + 1}`,
      name: project.name?.trim().slice(0, 28) || '',
      icon: project.icon?.trim() || '✨',
      url: validateUrl(project.url?.trim() ?? ''),
      displayType: project.displayType === 'icon' ? 'icon' : 'icon+text',
    }))
    .filter((project) => project.name && project.url);
}

export function getPrimaryProjectUrl(data: Pick<CardData, 'projects' | 'primaryProjectUrl'>): string {
  return validateUrl(data.primaryProjectUrl?.trim() ?? '') || normalizeFeaturedProjects(data.projects)[0]?.url || '';
}

export function createEmptyProject(index: number): FeaturedProject {
  return {
    id: `project-${index + 1}`,
    name: '',
    icon: '✨',
    url: '',
    displayType: 'icon+text',
  };
}

const VALID_PRESET_BACKGROUNDS = new Set<string>(PRESET_BACKGROUNDS.map((b) => b.value));
const MAX_MODEL_BREAKDOWN_ENTRIES = 5;

function normalizeModelBreakdown(mb: ModelBreakdown[] | undefined): ModelBreakdown[] {
  if (!mb?.length) return DEFAULT_CARD_DATA.modelBreakdown;

  return mb.slice(0, MAX_MODEL_BREAKDOWN_ENTRIES).map((entry) => ({
    name: String(entry?.name ?? '').slice(0, 32),
    percentage: Math.max(0, Math.min(100, Number(entry?.percentage ?? 0))),
    color: validateHexColor(String(entry?.color ?? ''), '#6b7280'),
  }));
}

function normalizeBackground(
  type: CardData['backgroundType'],
  value: string
): Pick<CardData, 'backgroundType' | 'backgroundValue'> {
  if (type === 'preset') {
    if (VALID_PRESET_BACKGROUNDS.has(value)) {
      return { backgroundType: 'preset', backgroundValue: value };
    }
    return { backgroundType: 'none', backgroundValue: '' };
  }
  if (type === 'custom') {
    return { backgroundType: 'none', backgroundValue: '' };
  }
  return { backgroundType: 'none', backgroundValue: '' };
}

function normalizeAvatarValue(avatarType: CardData['avatarType'], value: string): string {
  if (avatarType === 'github') {
    if (/^https:\/\/github\.com\/[a-zA-Z0-9\-]{1,39}\.png$/.test(value)) {
      return value;
    }
    return DEFAULT_CARD_DATA.avatarValue;
  }
  if (avatarType === 'photo') {
    // Only allow https URLs for photos from shared payloads (data: URIs are stripped earlier)
    if (value.startsWith('https://')) return value;
    return DEFAULT_CARD_DATA.avatarValue;
  }
  return value || DEFAULT_CARD_DATA.avatarValue;
}


export function encodeSharedCardPayload(data: CardData): string | null {
  const targetUrl = getPrimaryProjectUrl(data);
  if (!targetUrl) {
    return null;
  }

  const avatar = getShareSafeAvatar(data);
  const background = getShareSafeBackground(data);
  const projects = normalizeFeaturedProjects(data.projects);
  const referralCode = sanitizeReferralCode(data.referralCode || data.username);

  const payload: SharedCardPayloadV1 = {
    v: 1,
    u: data.username,
    at: avatar.avatarType,
    av: avatar.avatarValue,
    s: data.slogan,
    m: data.customMetaphor,
    t: data.totalTokens,
    lt: data.lastMonthTokens,
    c: data.channel,
    reg: normalizeRegion(data.region),
    org: normalizeCompany(data.company),
    ca: data.createdAt,
    th: data.theme,
    bgT: background.backgroundType,
    bgV: background.backgroundValue,
    mb: data.modelBreakdown,
    mc: data.metaphorCategory,
    l: data.locale,
    p: data.platform,
    link: targetUrl,
    pr: projects,
    ppn: data.primaryProjectName,
    ppu: data.primaryProjectUrl,
    ppp: data.primaryProjectPitch,
    ref: referralCode,
    tr: data.trustTier,
    ps: data.proofSource,
    pds: data.proofDateRange?.start,
    pde: data.proofDateRange?.end,
    iat: data.importedAt,
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

    const targetUrl = validateUrl(payload.link);
    if (!targetUrl) {
      return null;
    }

    const referralCode = sanitizeReferralCode(payload.ref ?? payload.u ?? '');
    const trustTier = normalizeTrustTier(payload.tr);
    const proofSource = normalizeProofSource(payload.ps);
    const proofDateRange = payload.pds || payload.pde
      ? {
          start: payload.pds,
          end: payload.pde,
        }
      : undefined;

    const validatedBackground = normalizeBackground(
      payload.bgT ?? DEFAULT_CARD_DATA.backgroundType,
      payload.bgV ?? ''
    );

    return {
      card: {
        ...DEFAULT_CARD_DATA,
        username: String(payload.u ?? DEFAULT_CARD_DATA.username).slice(0, 64),
        avatarType: payload.at ?? DEFAULT_CARD_DATA.avatarType,
        avatarValue: normalizeAvatarValue(
          payload.at ?? DEFAULT_CARD_DATA.avatarType,
          payload.av ?? DEFAULT_CARD_DATA.avatarValue
        ),
        slogan: String(payload.s ?? DEFAULT_CARD_DATA.slogan).slice(0, 200),
        customMetaphor: String(payload.m ?? DEFAULT_CARD_DATA.customMetaphor).slice(0, 200),
        totalTokens: Math.max(0, Number(payload.t ?? 0)),
        lastMonthTokens: Math.max(0, Number(payload.lt ?? 0)),
        channel: payload.c ?? DEFAULT_CARD_DATA.channel,
        region: normalizeRegion(payload.reg),
        company: normalizeCompany(payload.org),
        createdAt: payload.ca,
        theme: normalizeTheme(payload.th),
        backgroundType: validatedBackground.backgroundType,
        backgroundValue: validatedBackground.backgroundValue,
        modelBreakdown: normalizeModelBreakdown(payload.mb),
        qrcodeUrl: '',
        platform: payload.p ?? DEFAULT_CARD_DATA.platform,
        metaphorCategory: payload.mc ?? DEFAULT_CARD_DATA.metaphorCategory,
        locale: payload.l ?? DEFAULT_CARD_DATA.locale,
        projects: normalizeFeaturedProjects(payload.pr ?? []),
        primaryProjectName: String(payload.ppn ?? DEFAULT_CARD_DATA.primaryProjectName).slice(0, 64),
        primaryProjectUrl: validateUrl(String(payload.ppu ?? DEFAULT_CARD_DATA.primaryProjectUrl).slice(0, 512)),
        primaryProjectPitch: String(payload.ppp ?? DEFAULT_CARD_DATA.primaryProjectPitch).slice(0, 200),
        referralCode,
        trustTier,
        proofSource,
        proofDateRange,
        importedAt: payload.iat,
      },
      targetUrl,
      referralCode,
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

  const url = new URL('/u', origin.replace(/\/$/, ''));
  url.searchParams.set('d', encoded);

  const referralCode = sanitizeReferralCode(data.referralCode || data.username);
  if (referralCode) {
    url.searchParams.set('ref', referralCode);
  }

  return url.toString();
}

export function encodeCardTemplatePreset(data: CardData): string {
  const avatar = getShareSafeAvatar(data);
  const background = getShareSafeBackground(data);

  const preset: CardTemplatePresetV1 = {
    v: 1,
    at: avatar.avatarType,
    av: avatar.avatarValue,
    c: data.channel,
    reg: normalizeRegion(data.region),
    org: normalizeCompany(data.company),
    th: data.theme,
    bgT: background.backgroundType,
    bgV: background.backgroundValue,
    mb: data.modelBreakdown,
    mc: data.metaphorCategory,
    l: data.locale,
    p: data.platform,
    pr: normalizeFeaturedProjects(data.projects),
    ppn: data.primaryProjectName,
    ppu: data.primaryProjectUrl,
    ppp: data.primaryProjectPitch,
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

    const validatedBg = normalizeBackground(
      preset.bgT ?? DEFAULT_CARD_DATA.backgroundType,
      preset.bgV ?? ''
    );

    return {
      ...DEFAULT_CARD_DATA,
      username: '',
      slogan: '',
      customMetaphor: '',
      totalTokens: 0,
      lastMonthTokens: 0,
      qrcodeUrl: '',
      referralCode: '',
      avatarType: preset.at ?? DEFAULT_CARD_DATA.avatarType,
      avatarValue: normalizeAvatarValue(
        preset.at ?? DEFAULT_CARD_DATA.avatarType,
        preset.av ?? DEFAULT_CARD_DATA.avatarValue
      ),
      channel: preset.c ?? DEFAULT_CARD_DATA.channel,
      region: normalizeRegion(preset.reg),
      company: normalizeCompany(preset.org),
      theme: normalizeTheme(preset.th),
      backgroundType: validatedBg.backgroundType,
      backgroundValue: validatedBg.backgroundValue,
      modelBreakdown: normalizeModelBreakdown(preset.mb),
      metaphorCategory: preset.mc ?? DEFAULT_CARD_DATA.metaphorCategory,
      locale: preset.l ?? DEFAULT_CARD_DATA.locale,
      platform: preset.p ?? DEFAULT_CARD_DATA.platform,
      projects: normalizeFeaturedProjects(preset.pr ?? []),
      primaryProjectName: String(preset.ppn ?? DEFAULT_CARD_DATA.primaryProjectName).slice(0, 64),
      primaryProjectUrl: String(preset.ppu ?? DEFAULT_CARD_DATA.primaryProjectUrl).slice(0, 512),
      primaryProjectPitch: String(preset.ppp ?? DEFAULT_CARD_DATA.primaryProjectPitch).slice(0, 200),
    };
  } catch {
    return null;
  }
}

export function buildCreateFromTemplateUrl(data: CardData, origin: string): string {
  const encoded = encodeCardTemplatePreset(data);
  return `${origin.replace(/\/$/, '')}/create?p=${encoded}`;
}
