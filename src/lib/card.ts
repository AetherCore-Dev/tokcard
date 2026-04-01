import type { RankTierInfo } from '@/lib/titles';

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
  projects: FeaturedProject[];
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
  th: CardData['theme'];
  bgT: CardData['backgroundType'];
  bgV: string;
  mb: ModelBreakdown[];
  mc: CardData['metaphorCategory'];
  l: CardData['locale'];
  p: CardData['platform'];
  link: string;
  pr?: FeaturedProject[];
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
  th: CardData['theme'];
  bgT: CardData['backgroundType'];
  bgV: string;
  mb: ModelBreakdown[];
  mc: CardData['metaphorCategory'];
  l: CardData['locale'];
  p: CardData['platform'];
  pr?: FeaturedProject[];
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
  { value: '/images/backgrounds/neon-circuit.jpg', label: 'Neon Circuit', labelZh: '霓虹电路' },
  { value: '/images/backgrounds/neon-nebula.jpg', label: 'Neon Nebula', labelZh: '霓虹星云' },
  { value: '/images/backgrounds/neon-orbs.jpg', label: 'Neon Orbs', labelZh: '霓虹光球' },
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
    description: 'Share-first mode. Great for posting, but not used for official rankings.',
    descriptionZh: '适合先发出来，先传播；默认不进入正式排名。',
    accent: '#64748b',
  },
  'screenshot-backed': {
    label: 'Proof attached',
    labelZh: '截图佐证',
    description: 'Backed by a screenshot from a usage dashboard or billing page.',
    descriptionZh: '已附 usage 或账单截图，可信度更高。',
    accent: '#0ea5e9',
  },
  'usage-imported': {
    label: 'Usage imported',
    labelZh: '数据导入',
    description: 'Imported from usage text or dashboard summaries and ready for stronger ranking signals.',
    descriptionZh: '已导入 usage 文本或摘要，可解锁更强的排名展示。',
    accent: '#f59e0b',
  },
  'strong-authenticated': {
    label: 'Verified source',
    labelZh: '官方验证',
    description: 'Reserved for future direct source integrations.',
    descriptionZh: '预留给未来更强的官方数据接入。',
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

export function normalizeTrustTier(value?: string): TrustTier {
  return TRUST_TIER_VALUES.includes(value as TrustTier) ? (value as TrustTier) : 'self-reported';
}

export function normalizeProofSource(value?: string): ProofSource | undefined {
  return PROOF_SOURCE_VALUES.includes(value as ProofSource) ? (value as ProofSource) : undefined;
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
      ? `当前只展示 ${rankTier.label} 档位，不作为正式排名。`
      : `Currently shown as a ${rankTier.labelEn} tier signal only, not a formal ranking.`;
  }

  if (trustTier === 'screenshot-backed') {
    return locale === 'zh'
      ? `基于截图佐证，可用于 ${rankTier.topPercentLabel} 的区间比较。`
      : `Screenshot-backed and suitable for ${rankTier.topPercentLabelEn} range-style comparison.`;
  }

  return locale === 'zh'
    ? `已具备更强的排名展示资格，可落在 ${rankTier.topPercentLabel} 区间。`
    : `Ready for stronger ranking views and eligible for the ${rankTier.topPercentLabelEn} bracket.`;
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
  referralCode: '',
  trustTier: 'self-reported',
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

export function sanitizeReferralCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function normalizeFeaturedProjects(projects: FeaturedProject[]): FeaturedProject[] {
  return projects
    .slice(0, FEATURED_PROJECT_LIMIT)
    .map((project, index) => ({
      id: project.id?.trim() || `project-${index + 1}`,
      name: project.name?.trim().slice(0, 28) || '',
      icon: project.icon?.trim() || '✨',
      url: project.url?.trim() || '',
      displayType: project.displayType === 'icon' ? 'icon' : 'icon+text',
    }))
    .filter((project) => project.name && project.url);
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

export function encodeSharedCardPayload(data: CardData): string | null {
  if (!data.qrcodeUrl.trim()) {
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
    th: data.theme,
    bgT: background.backgroundType,
    bgV: background.backgroundValue,
    mb: data.modelBreakdown,
    mc: data.metaphorCategory,
    l: data.locale,
    p: data.platform,
    link: data.qrcodeUrl.trim(),
    pr: projects,
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

    const referralCode = sanitizeReferralCode(payload.ref ?? payload.u ?? '');
    const trustTier = normalizeTrustTier(payload.tr);
    const proofSource = normalizeProofSource(payload.ps);
    const proofDateRange = payload.pds || payload.pde
      ? {
          start: payload.pds,
          end: payload.pde,
        }
      : undefined;

    return {
      card: {
        ...DEFAULT_CARD_DATA,
        username: payload.u ?? DEFAULT_CARD_DATA.username,
        avatarType: payload.at ?? DEFAULT_CARD_DATA.avatarType,
        avatarValue: payload.av ?? DEFAULT_CARD_DATA.avatarValue,
        slogan: payload.s ?? DEFAULT_CARD_DATA.slogan,
        customMetaphor: payload.m ?? DEFAULT_CARD_DATA.customMetaphor,
        totalTokens: payload.t ?? DEFAULT_CARD_DATA.totalTokens,
        lastMonthTokens: payload.lt ?? DEFAULT_CARD_DATA.lastMonthTokens,
        channel: payload.c ?? DEFAULT_CARD_DATA.channel,
        theme: payload.th ?? DEFAULT_CARD_DATA.theme,
        backgroundType: payload.bgT ?? DEFAULT_CARD_DATA.backgroundType,
        backgroundValue: payload.bgV ?? DEFAULT_CARD_DATA.backgroundValue,
        modelBreakdown: payload.mb?.length ? payload.mb : DEFAULT_CARD_DATA.modelBreakdown,
        qrcodeUrl: '',
        platform: payload.p ?? DEFAULT_CARD_DATA.platform,
        metaphorCategory: payload.mc ?? DEFAULT_CARD_DATA.metaphorCategory,
        locale: payload.l ?? DEFAULT_CARD_DATA.locale,
        projects: normalizeFeaturedProjects(payload.pr ?? []),
        referralCode,
        trustTier,
        proofSource,
        proofDateRange,
        importedAt: payload.iat,
      },
      targetUrl: payload.link,
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

export function buildOgPreviewUrl(data: CardData, origin: string): string {
  const encoded = encodeSharedCardPayload(data);
  const url = new URL('/api/og-preview', origin.replace(/\/$/, ''));

  if (encoded) {
    url.searchParams.set('d', encoded);
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
    th: data.theme,
    bgT: background.backgroundType,
    bgV: background.backgroundValue,
    mb: data.modelBreakdown,
    mc: data.metaphorCategory,
    l: data.locale,
    p: data.platform,
    pr: normalizeFeaturedProjects(data.projects),
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
      lastMonthTokens: 0,
      qrcodeUrl: '',
      referralCode: '',
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
      projects: normalizeFeaturedProjects(preset.pr ?? []),
    };
  } catch {
    return null;
  }
}

export function buildCreateFromTemplateUrl(data: CardData, origin: string): string {
  const encoded = encodeCardTemplatePreset(data);
  return `${origin.replace(/\/$/, '')}/create?p=${encoded}`;
}
