import type { CardData, ModelBreakdown, FeaturedProject } from '@/lib/card';
import { getPrimaryProjectUrl, normalizeCompany, normalizeFeaturedProjects, normalizeRegion, sanitizeReferralCode } from '@/lib/card';

interface SaveCardResponse {
  id: string;
  url: string;
}

interface SharedCardPayloadForStorage {
  v: 1;
  u: string;
  at: CardData['avatarType'];
  av: string;
  s: string;
  m: string;
  t: number;
  tw?: CardData['tokenWindow'];
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
  tr?: CardData['trustTier'];
  ps?: CardData['proofSource'];
  pds?: string;
  pde?: string;
  iat?: string;
  gr?: number;
  pct?: number;
}

function getShareSafeAvatar(data: CardData): Pick<CardData, 'avatarType' | 'avatarValue'> {
  if (data.avatarType === 'photo' && data.avatarValue.startsWith('data:image')) {
    return { avatarType: 'emoji', avatarValue: '🤖' };
  }
  return { avatarType: data.avatarType, avatarValue: data.avatarValue || '🤖' };
}

function getShareSafeBackground(data: CardData): Pick<CardData, 'backgroundType' | 'backgroundValue'> {
  if (data.backgroundType === 'custom') {
    return { backgroundType: 'none', backgroundValue: '' };
  }
  return { backgroundType: data.backgroundType, backgroundValue: data.backgroundValue };
}

function buildPayloadForStorage(data: CardData): SharedCardPayloadForStorage {
  const avatar = getShareSafeAvatar(data);
  const background = getShareSafeBackground(data);
  const projects = normalizeFeaturedProjects(data.projects);
  const referralCode = sanitizeReferralCode(data.referralCode || data.username);
  const targetUrl = getPrimaryProjectUrl(data);

  return {
    v: 1,
    u: data.username,
    at: avatar.avatarType,
    av: avatar.avatarValue,
    s: data.slogan,
    m: data.customMetaphor,
    t: data.totalTokens,
    tw: data.tokenWindow,
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
    gr: data.globalRank,
    pct: data.percentile,
  };
}

/**
 * Save card data to KV via API and return a short URL.
 * Falls back to the legacy base64 URL if the API fails.
 */
export async function saveCardAndGetShortUrl(
  data: CardData,
  origin: string
): Promise<{ shortUrl: string; cardId: string } | null> {
  if (!getPrimaryProjectUrl(data)) {
    return null;
  }

  const payload = buildPayloadForStorage(data);

  try {
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as SaveCardResponse;
    const referralCode = sanitizeReferralCode(data.referralCode || data.username);
    const shortUrl = referralCode
      ? `${origin}/u/${result.id}?ref=${encodeURIComponent(referralCode)}`
      : `${origin}/u/${result.id}`;

    return { shortUrl, cardId: result.id };
  } catch {
    return null;
  }
}
