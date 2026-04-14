import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { parseAIOptions } from '@/lib/deepseek';
import type { CardData, FeaturedProject, ProofSource } from '@/lib/card';
import {
  buildSharedCardUrl,
  canParticipateInRanking,
  createEmptyProject,
  decodeCardTemplatePreset,
  DEFAULT_CARD_DATA,
  FEATURED_PROJECT_LIMIT,
  formatProofDateRange,
  formatTokenValueEstimate,
  formatTokens,
  formatTokensFull,
  getPrimaryProjectUrl,
  getProofSourceLabel,
  getRankingSignalDescription,
  getRankingSignalLabel,
  getTrustTierAccent,
  getTrustTierDescription,
  getTrustTierLabel,
  normalizeFeaturedProjects,
  normalizeTheme,
  parseTokenValue,
  PLATFORMS,
  PROOF_SOURCE_META,
  sanitizeReferralCode,
} from '@/lib/card';
import { getMetaphor } from '@/lib/metaphor';
import { CARD_PRESETS, type CardPreset } from '@/lib/presets';
import { shareWithFallback } from '@/lib/share';
import { saveCardAndGetShortUrl } from '@/lib/card-storage';
import { getRankTier } from '@/lib/titles';
import CardRenderer from './CardRenderer';
import SuccessAnimation from './SuccessAnimation';
import { domToBlob } from 'modern-screenshot';

const PRESET_EMOJIS = ['🤖', '👨‍💻', '👩‍💻', '🚀', '⚡', '🧠', '🔥', '💻', '🎮', '🦾', '🌟', '🕹️'];

const CURATED_THEME_OPTIONS = [
  { value: 'brand-dark', labelZh: '深夜信号', labelEn: 'Midnight Signal', preview: 'bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#8b5cf6_100%)] border-[#334155]' },
  { value: 'brand-light', labelZh: '柔光渐层', labelEn: 'Soft Glow', preview: 'bg-[linear-gradient(135deg,#fff7ed_0%,#fdf2f8_55%,#eff6ff_100%)] border-[#fbcfe8]' },
  { value: 'minimal-gray', labelZh: '雾面专业', labelEn: 'Mist Minimal', preview: 'bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_45%,#e2e8f0_100%)] border-[#cbd5e1]' },
] as const;

const PLATFORM_TEMPLATE_NOTES: Record<CardData['platform'], { zh: string; en: string }> = {
  wechat: {
    zh: '适合微信 / 朋友圈，语气更稳，更像可信介绍。',
    en: 'For WeChat and Moments with a calmer, trust-first tone.',
  },
  twitter: {
    zh: '适合发 X / Twitter，强调速度、发布感和观点。',
    en: 'For X with sharper launch energy and stronger opinions.',
  },
  instagram: {
    zh: '适合竖版视觉表达。',
    en: 'Best for vertical visual storytelling.',
  },
  weibo: {
    zh: '适合微博转发和热点传播，信息要更抓眼。',
    en: 'For repost energy and hotter visibility on Weibo.',
  },
  xiaohongshu: {
    zh: '适合小红书，强调颜值、项目感和分享欲。',
    en: 'For Xiaohongshu with a softer, polished visual vibe.',
  },
  linkedin: {
    zh: '适合 LinkedIn / 主页，强调专业和可信。',
    en: 'For LinkedIn and portfolio sharing with a more credible feel.',
  },
};

interface AICaptionOption {
  title: string;
  body: string;
  hashtags: string[];
  emoji: string;
  vibe: 'flex' | 'hype' | 'technical';
}

interface RankSummary {
  globalRank: number;
  totalCards: number;
  channelRank: number | null;
  regionRank: number | null;
  percentile: number;
}

function detectProofSourceFromText(raw: string): ProofSource | undefined {
  const value = raw.toLowerCase();
  if (value.includes('openrouter')) return 'openrouter';
  if (value.includes('cursor')) return 'cursor';
  if (value.includes('anthropic')) return 'anthropic';
  if (value.includes('claude')) return 'claude';
  if (value.includes('openai') || value.includes('chatgpt') || value.includes('gpt-')) return 'openai';
  if (value.includes('gemini')) return 'gemini';
  if (value.includes('deepseek')) return 'deepseek';
  return undefined;
}

function extractImportedTokenValues(raw: string): number[] {
  const matches = raw.match(/\d[\d,.]*(?:\.\d+)?\s*(?:billion|million|thousand|[kmb]|\u4e07|\u4ebf|tokens?)?/gi) ?? [];

  return matches
    .map((chunk) => chunk
      .replace(/billion/gi, 'B')
      .replace(/million/gi, 'M')
      .replace(/thousand/gi, 'K')
      .replace(/\s+/g, '')
    )
    .map((chunk) => parseTokenValue(chunk))
    .filter((value) => value > 0)
    .sort((a, b) => b - a);
}

function buildTrustCopyParts({
  isZh,
  trustTierLabel,
  proofSourceLabel,
  proofRangeLabel,
  rankingSignalLabel,
  rankingSignalDescription,
  trustTier,
}: {
  isZh: boolean;
  trustTierLabel: string;
  proofSourceLabel: string;
  proofRangeLabel: string;
  rankingSignalLabel: string;
  rankingSignalDescription: string;
  trustTier: CardData['trustTier'];
}) {
  if (isZh) {
    if (trustTier === 'screenshot-backed') {
      return {
        trustLead: `${proofSourceLabel || 'usage'} 截图佐证，当前更接近 ${rankingSignalLabel}。`,
        trustTail: `这张卡现在会带上「${trustTierLabel}」说明${proofRangeLabel ? `（${proofRangeLabel}）` : ''}。`,
      };
    }

    if (trustTier === 'usage-imported' || trustTier === 'strong-authenticated') {
      return {
        trustLead: `这张卡基于${proofSourceLabel || 'usage'}记录导入，当前落在 ${rankingSignalLabel}。`,
        trustTail: `${trustTierLabel} 状态会一起出现在分享页里，方便别人判断可信度。`,
      };
    }

    return {
      trustLead: `先把最近的 AI build 强度整理成一张 TokCard，当前是 ${rankingSignalLabel}。`,
      trustTail: `${rankingSignalDescription} 后面我会再补截图或导入记录。`,
    };
  }

  if (trustTier === 'screenshot-backed') {
    return {
      trustLead: `This card is backed by ${proofSourceLabel || 'usage'} screenshots and currently reads closer to ${rankingSignalLabel}.`,
      trustTail: `It will travel with a ${trustTierLabel} label${proofRangeLabel ? ` (${proofRangeLabel})` : ''}.`,
    };
  }

  if (trustTier === 'usage-imported' || trustTier === 'strong-authenticated') {
    return {
      trustLead: `This card is based on imported ${proofSourceLabel || 'usage'} records and currently sits in the ${rankingSignalLabel}.`,
      trustTail: `The ${trustTierLabel} state also carries into the shared landing page for better trust.`,
    };
  }

  return {
    trustLead: `Packed my recent AI build intensity into a TokCard. Right now it is framed as a ${rankingSignalLabel}.`,
    trustTail: `${rankingSignalDescription} I can add proof later if I want stronger comparison signals.`,
  };
}

function getCaptionSortScore(vibe: AICaptionOption['vibe'], trustTier: CardData['trustTier']): number {
  if (trustTier === 'self-reported') {
    return vibe === 'hype' ? 3 : vibe === 'flex' ? 2 : 1;
  }

  if (trustTier === 'screenshot-backed') {
    return vibe === 'technical' ? 3 : vibe === 'hype' ? 2 : 1;
  }

  return vibe === 'technical' ? 3 : vibe === 'flex' ? 2 : 1;
}

function sortCaptionOptionsForTrust(options: AICaptionOption[], trustTier: CardData['trustTier']): AICaptionOption[] {
  return options
    .map((option, index) => ({ option, index, score: getCaptionSortScore(option.vibe, trustTier) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ option }) => option);
}

function getCaptionTrustMeta(
  vibe: AICaptionOption['vibe'],
  trustTier: CardData['trustTier'],
  locale: 'zh' | 'en'
): { badge: string; helper: string; toneClass: string } {
  const isZh = locale === 'zh';

  if (vibe === 'technical') {
    if (trustTier === 'usage-imported' || trustTier === 'strong-authenticated') {
      return {
        badge: isZh ? '当前最适配' : 'Best fit now',
        helper: isZh ? '更适合数据导入 / 高可信表达。' : 'Best for imported or high-trust sharing.',
        toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    }

    if (trustTier === 'screenshot-backed') {
      return {
        badge: isZh ? '可信表达' : 'Trust fit',
        helper: isZh ? '很适合截图佐证后的发布场景。' : 'A strong fit for screenshot-backed sharing.',
        toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
      };
    }

    return {
      badge: isZh ? '补证明后更强' : 'Stronger with proof',
      helper: isZh ? '先发也可以，补截图/导入后说服力更高。' : 'Works now, but becomes stronger once proof is added.',
      toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }

  if (vibe === 'flex') {
    if (trustTier === 'self-reported') {
      return {
        badge: isZh ? '当前适配' : 'Good fit now',
        helper: isZh ? '适合先发排面，再慢慢补可信度。' : 'Great for posting first, then upgrading trust later.',
        toneClass: 'border-violet-200 bg-violet-50 text-violet-700',
      };
    }

    return {
      badge: isZh ? '有排面也有可信度' : 'Proof + flex',
      helper: isZh ? '适合想保留气场、又不想显得太虚。' : 'Balances strong flex energy with visible credibility.',
      toneClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    };
  }

  if (trustTier === 'self-reported') {
    return {
      badge: isZh ? '轻量传播' : 'Lightweight viral',
      helper: isZh ? '适合先引发关注，不强调正式比较。' : 'Best for attention and reach, not formal comparison.',
      toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  return {
    badge: isZh ? '有证据更好发' : 'Proof-friendly',
    helper: isZh ? '适合带着 trust 标签一起扩散。' : 'Works well when the trust label travels with the card.',
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  };
}

function parseCaptionOptions(raw: string): AICaptionOption[] {
  return raw
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      const title = lines.find((line) => line.startsWith('TITLE:'))?.replace('TITLE:', '').trim() ?? '';
      const body = lines.find((line) => line.startsWith('BODY:'))?.replace('BODY:', '').trim() ?? '';
      const hashtags = (lines.find((line) => line.startsWith('HASHTAGS:'))?.replace('HASHTAGS:', '').trim().split(/\s+/).filter(Boolean) ?? []).slice(0, 2);
      const emoji = lines.find((line) => line.startsWith('EMOJI:'))?.replace('EMOJI:', '').trim() ?? '🔥';
      const vibe = (lines.find((line) => line.startsWith('VIBE:'))?.replace('VIBE:', '').trim() ?? 'hype') as AICaptionOption['vibe'];
      return { title, body, hashtags, emoji, vibe };
    })
    .filter((item) => item.title || item.body)
    .slice(0, 3);
}

export default function CardEditor() {
  const [data, setData] = useState<CardData>({ ...DEFAULT_CARD_DATA, theme: 'brand-light' });
  const [tokenInput, setTokenInput] = useState('');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [aiSlogans, setAiSlogans] = useState<string[]>([]);
  const [aiCaptions, setAiCaptions] = useState<AICaptionOption[]>([]);
  const [aiPitches, setAiPitches] = useState<string[]>([]);
  const [isGeneratingSlogan, setIsGeneratingSlogan] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [siteOrigin, setSiteOrigin] = useState('');
  const [exportCardSnapshot, setExportCardSnapshot] = useState<CardData | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'caption' | 'link' | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportNoticeTone, setExportNoticeTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [shareCardId, setShareCardId] = useState('');
  const [shareRankSummary, setShareRankSummary] = useState<RankSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);
  const exportNoticeTimeoutRef = useRef<number | null>(null);
  const [proofCaptureMode, setProofCaptureMode] = useState<'screenshot' | 'import'>('screenshot');
  const [proofFiles, setProofFiles] = useState<{ name: string; size: number }[]>([]);
  const [usageImportText, setUsageImportText] = useState('');
  const [proofFeedback, setProofFeedback] = useState<string | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [hasInitializedMobilePreview, setHasInitializedMobilePreview] = useState(false);

  // Platform detection for download handling
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  // Container ref for responsive scaling
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.72);
  const [isPreviewReady, setIsPreviewReady] = useState(true);
  const previewRenderId = 'tokcard-preview';
  const exportRenderId = 'tokcard-export';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);
    if (isIOS) setPlatform('ios');
    else if (isAndroid) setPlatform('android');
    else setPlatform('desktop');
    setSiteOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!isMobile || hasInitializedMobilePreview) return;
    setStep(1);
    setHasInitializedMobilePreview(true);
  }, [hasInitializedMobilePreview, isMobile]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const preset = searchParams.get('p');
    const localeParam = searchParams.get('locale');

    if (localeParam === 'en' || localeParam === 'zh') {
      setData((prev) => ({ ...prev, locale: localeParam }));
    }

    if (!preset) return;

    const decodedPreset = decodeCardTemplatePreset(preset);
    if (!decodedPreset) return;

    setData((prev) => ({ ...prev, ...decodedPreset }));
    setTokenInput(decodedPreset.totalTokens ? formatTokens(decodedPreset.totalTokens, decodedPreset.locale ?? 'zh') : '');
    setStep(4);
  }, []);

  // localStorage auto-save
  useEffect(() => {
    const saved = localStorage.getItem('tokcard:draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          const normalizedDraft = {
            ...parsed,
            theme: normalizeTheme((parsed as Partial<CardData>).theme),
          };
          setData(prev => ({ ...prev, ...normalizedDraft }));
          if (parsed.totalTokens) {
            setTokenInput(formatTokens(parsed.totalTokens, parsed.locale === 'en' ? 'en' : 'zh'));
          }
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (data.username || data.totalTokens > 0) {
        localStorage.setItem('tokcard:draft', JSON.stringify(data));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (data.totalTokens > 0) {
      setTokenInput((current) => current ? formatTokens(data.totalTokens, data.locale) : current);
    }
  }, [data.locale, data.totalTokens]);

  const isZh = data.locale === 'zh';
  const platformInfo = PLATFORMS[data.platform];
  const previewStageWidth = Math.round(platformInfo.width * 0.46);
  const previewStageHeight = Math.round(platformInfo.height * 0.46);
  const previewCardScale = Math.min((previewStageWidth - 16) / 540, (previewStageHeight - 20) / 720);
  const exportCardScale = Math.min((platformInfo.width - 36) / 540, (platformInfo.height - 56) / 720);
  const stageBackground = data.theme === 'brand-dark' ? '#05070b' : '#eef2ff';
  const activeMetaphor = useMemo(
    () => data.customMetaphor.trim() || getMetaphor(data.totalTokens || 10000, data.metaphorCategory, data.locale),
    [data.customMetaphor, data.totalTokens, data.metaphorCategory, data.locale]
  );
  const rankTier = useMemo(() => getRankTier(data.totalTokens), [data.totalTokens]);
  const normalizedProjects = useMemo(() => normalizeFeaturedProjects(data.projects), [data.projects]);
  const primaryProjectUrl = useMemo(() => getPrimaryProjectUrl(data), [data]);
  const previewCardData = useMemo(() => {
    const previewBaseCard = {
      ...data,
      referralCode: sanitizeReferralCode(data.referralCode || data.username || data.primaryProjectName),
    };
    const previewShareLink = siteOrigin
      ? buildSharedCardUrl(previewBaseCard, siteOrigin) ?? siteOrigin
      : '';

    return {
      ...previewBaseCard,
      qrcodeUrl: previewShareLink,
    };
  }, [data, siteOrigin]);
  const exportCardData = exportCardSnapshot ?? previewCardData;
  const tokenCompactDisplay = useMemo(() => (data.totalTokens > 0 ? formatTokens(data.totalTokens, data.locale) : '0'), [data.locale, data.totalTokens]);
  const tokenFullDisplay = useMemo(() => (data.totalTokens > 0 ? formatTokensFull(data.totalTokens, data.locale) : '0'), [data.locale, data.totalTokens]);
  const tokenValueEstimate = useMemo(() => formatTokenValueEstimate(data.totalTokens, data.locale), [data.locale, data.totalTokens]);
  const presetGroups = useMemo(() => (
    (['twitter', 'linkedin', 'wechat', 'weibo', 'xiaohongshu'] as CardData['platform'][])
      .map((platform) => ({
        platform,
        label: isZh ? PLATFORMS[platform].labelZh : PLATFORMS[platform].label,
        note: isZh ? PLATFORM_TEMPLATE_NOTES[platform].zh : PLATFORM_TEMPLATE_NOTES[platform].en,
        presets: CARD_PRESETS.filter((preset) => preset.platform === platform),
      }))
      .filter((group) => group.presets.length > 0)
  ), [isZh]);
  const readinessItems = useMemo(() => ([
    {
      id: 'tokens',
      label: isZh ? 'Token 战绩' : 'Token signal',
      done: data.totalTokens > 0,
      hint: isZh ? '先让别人看到你有多能打' : 'The first thing people should notice',
    },
    {
      id: 'project-name',
      label: isZh ? '项目名称' : 'Project name',
      done: Boolean(data.primaryProjectName.trim()),
      hint: isZh ? '名片上要说清你在做什么' : 'Tell people what you are building',
    },
    {
      id: 'project-pitch',
      label: isZh ? '项目一句话' : 'Project pitch',
      done: Boolean(data.primaryProjectPitch.trim()),
      hint: isZh ? '一句话解释为什么值得点开' : 'Explain why the project matters',
    },
    {
      id: 'project-link',
      label: isZh ? '项目入口' : 'Project link',
      done: Boolean(primaryProjectUrl),
      hint: isZh ? '分享后别人可以直接进入你的项目' : 'People can open your project from the card',
    },
  ]), [data.primaryProjectName, data.primaryProjectPitch, data.totalTokens, isZh, primaryProjectUrl]);
  const readinessScore = useMemo(() => readinessItems.filter((item) => item.done).length, [readinessItems]);
  const trustTierLabel = useMemo(() => getTrustTierLabel(data.trustTier, data.locale), [data.locale, data.trustTier]);
  const trustTierDescription = useMemo(() => getTrustTierDescription(data.trustTier, data.locale), [data.locale, data.trustTier]);
  const trustTierAccent = useMemo(() => getTrustTierAccent(data.trustTier), [data.trustTier]);
  const proofSourceLabel = useMemo(() => (
    data.proofSource ? getProofSourceLabel(data.proofSource, data.locale) : ''
  ), [data.locale, data.proofSource]);
  const proofRangeLabel = useMemo(() => formatProofDateRange(data.proofDateRange, data.locale), [data.locale, data.proofDateRange]);
  const fieldErrors = useMemo(() => ({
    tokens: data.totalTokens <= 0,
    primaryProjectName: !data.primaryProjectName.trim(),
    primaryProjectPitch: !data.primaryProjectPitch.trim(),
    project: !primaryProjectUrl,
  }), [data.primaryProjectName, data.primaryProjectPitch, data.totalTokens, primaryProjectUrl]);
  const exportIssues = useMemo(() => {
    const issues: string[] = [];
    if (fieldErrors.tokens) issues.push(isZh ? '请先填写有效的 Token 消耗量。' : 'Add a valid token amount first.');
    if (fieldErrors.primaryProjectName) issues.push(isZh ? '请填写主项目名称。' : 'Add a primary project name.');
    if (fieldErrors.primaryProjectPitch) issues.push(isZh ? '请填写一句能打的项目介绍。' : 'Add a strong one-line project pitch.');
    if (fieldErrors.project) issues.push(isZh ? '请填写有效的主项目链接。' : 'Add a valid primary project link.');
    return issues;
  }, [fieldErrors, isZh]);
  const canExport = exportIssues.length === 0;
  const nextMobileEditStep: 1 | 2 | 3 = fieldErrors.tokens
    ? 1
    : (fieldErrors.primaryProjectName || fieldErrors.primaryProjectPitch || fieldErrors.project)
      ? 2
      : 3;
  const rankingSignalLabel = useMemo(() => getRankingSignalLabel(rankTier, data.trustTier, data.locale), [data.locale, data.trustTier, rankTier]);
  const rankingSignalDescription = useMemo(() => getRankingSignalDescription(rankTier, data.trustTier, data.locale), [data.locale, data.trustTier, rankTier]);
  const trustCopyParts = useMemo(() => buildTrustCopyParts({
    isZh,
    trustTierLabel,
    proofSourceLabel,
    proofRangeLabel,
    rankingSignalLabel,
    rankingSignalDescription,
    trustTier: data.trustTier,
  }), [data.trustTier, isZh, proofRangeLabel, proofSourceLabel, rankingSignalDescription, rankingSignalLabel, trustTierLabel]);
  const rankingAccessGuide = useMemo(() => {
    if (data.trustTier === 'self-reported') {
      return {
        title: isZh ? '当前还没进入正式排名' : 'Not in official rankings yet',
        description: isZh
          ? '现在先展示档位和项目，适合先传播。想进入正式排名，请上传 usage 截图或导入 usage 记录。'
          : 'The card currently leads with tier and project only. Add a usage screenshot or import usage records to enter official rankings.',
        nextStep: isZh ? '下一步：补 usage 截图，或直接导入 usage 文本。' : 'Next step: add a usage screenshot or import usage records.',
      };
    }

    if (data.trustTier === 'screenshot-backed') {
      return {
        title: isZh ? '已进入区间比较 / 百分位展示' : 'Eligible for percentile-style comparison',
        description: isZh
          ? '截图佐证后，这张卡已经具备基础的榜单比较资格。继续导入 usage 记录后，可获得更明确的排名位置。'
          : 'With screenshot proof attached, this card is eligible for range-style leaderboard comparison. Import usage records next for clearer rank placement.',
        nextStep: isZh ? '下一步：导入 usage 记录，解锁更明确的排名位置。' : 'Next step: import usage records for clearer ranking positions.',
      };
    }

    return {
      title: isZh ? '已具备正式排名资格' : 'Eligible for official rankings',
      description: isZh
        ? '当前状态已经可以进入正式排名，并支持排行榜聚焦查看。'
        : 'This state is already eligible for official rankings and focused leaderboard views.',
      nextStep: isZh ? '当前状态已经够用，后续只需要继续更新 token 和项目。' : 'You are already ranking. Keep the token number and project info fresh.',
    };
  }, [data.trustTier, isZh]);
  const sortedAiCaptions = useMemo(() => sortCaptionOptionsForTrust(aiCaptions, data.trustTier), [aiCaptions, data.trustTier]);

  useEffect(() => {
    const calculateScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.clientWidth;
      const horizontalPadding = isMobile ? 24 : 12;
      const availableWidth = Math.max(containerWidth - horizontalPadding, 0);
      const maxScale = isMobile ? 0.92 : 1;
      const minScale = isMobile ? 0.48 : 0.62;
      const nextScale = Math.min(availableWidth / previewStageWidth, maxScale);
      setPreviewScale(Math.max(minScale, Math.min(nextScale, 1)));
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [isMobile, previewStageWidth]);

  useEffect(() => {
    let cancelled = false;

    if (!shareCardId) {
      setShareRankSummary(null);
      return;
    }

    void fetch(`/api/rank?id=${shareCardId}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<RankSummary>;
      })
      .then((payload) => {
        if (!cancelled) {
          setShareRankSummary(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShareRankSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shareCardId]);

  const updateField = useCallback(<K extends keyof CardData>(key: K, value: CardData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateProofDateRange = useCallback((field: 'start' | 'end', value: string) => {
    setData((prev) => {
      const nextRange = {
        ...prev.proofDateRange,
        [field]: value,
      };

      if (!nextRange.start && !nextRange.end) {
        return {
          ...prev,
          proofDateRange: undefined,
        };
      }

      return {
        ...prev,
        proofDateRange: nextRange,
      };
    });
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = CARD_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setData((prev) => ({
      ...prev,
      ...preset.defaults,
      projects: prev.projects,
      referralCode: prev.referralCode,
      qrcodeUrl: prev.qrcodeUrl,
      trustTier: prev.trustTier,
      proofSource: prev.proofSource,
      proofDateRange: prev.proofDateRange,
      importedAt: prev.importedAt,
    }));
    setAiCaptions([]);
    setShareCaption('');
  }, []);

  const updateProject = useCallback((index: number, field: keyof FeaturedProject, value: string) => {
    setData((prev) => {
      const nextProjects = Array.from({ length: FEATURED_PROJECT_LIMIT }, (_, currentIndex) => prev.projects[currentIndex] ?? createEmptyProject(currentIndex));
      const current = nextProjects[index] ?? createEmptyProject(index);
      nextProjects[index] = {
        ...current,
        [field]: value,
      } as FeaturedProject;

      return {
        ...prev,
        projects: nextProjects,
      };
    });
  }, []);

  const KNOWN_SITES = {
    'github.com': { icon: '🐙', name: 'GitHub' },
    'twitter.com': { icon: '🐦', name: 'Twitter' },
    'x.com': { icon: '𝕏', name: 'X' },
    'linkedin.com': { icon: '💼', name: 'LinkedIn' },
    'youtube.com': { icon: '▶️', name: 'YouTube' },
    'bilibili.com': { icon: '📺', name: 'Bilibili' },
    'zhihu.com': { icon: '🔵', name: '知乎' },
    'xiaohongshu.com': { icon: '📕', name: '小红书' },
    'juejin.cn': { icon: '💎', name: '掘金' },
    'producthunt.com': { icon: '🚀', name: 'Product Hunt' },
    'notion.so': { icon: '📓', name: 'Notion' },
    'figma.com': { icon: '🎨', name: 'Figma' },
    'vercel.app': { icon: '▲', name: 'Vercel' },
    'netlify.app': { icon: '🌐', name: 'Netlify' },
  };

  const handleProjectUrlChange = useCallback((index: number, rawUrl: string) => {
    // Auto-add https:// if user pastes a bare domain
    let url = rawUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://') && url.includes('.')) {
      url = `https://${url}`;
    }
    updateProject(index, 'url', url);
    if (url) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        const match = Object.entries(KNOWN_SITES).find(([domain]) => hostname.includes(domain));
        // Only auto-fill if icon/name are still at defaults
        const currentProject = data.projects[index];
        const isDefaultIcon = !currentProject?.icon || currentProject.icon === '✨';
        const isDefaultName = !currentProject?.name;
        if (match) {
          if (isDefaultIcon) updateProject(index, 'icon', match[1].icon);
          if (isDefaultName) updateProject(index, 'name', match[1].name);
        } else {
          if (isDefaultIcon) updateProject(index, 'icon', '🔗');
          if (isDefaultName) updateProject(index, 'name', hostname.split('.')[0]);
        }
      } catch (_e) { /* invalid URL */ }
    }
  }, [data.projects, updateProject]);

  const ensureProjectSlots = useMemo(
    () => Array.from({ length: FEATURED_PROJECT_LIMIT }, (_, index) => data.projects[index] ?? createEmptyProject(index)),
    [data.projects]
  );

  const handleGenerateCaptions = useCallback(async () => {
    setIsGeneratingCaptions(true);
    setAiCaptions([]);
    setShareCaption('');
    try {
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: data.platform,
          tokens: data.totalTokens,
          metaphor: activeMetaphor,
          username: data.username || data.primaryProjectName || 'builder',
          locale: data.locale,
          slogan: data.slogan,
          projects: normalizeFeaturedProjects(data.projects).map((project) => project.name),
          primaryProjectName: data.primaryProjectName,
          primaryProjectPitch: data.primaryProjectPitch,
          trustTier: data.trustTier,
          trustTierLabel,
          proofSource: data.proofSource,
          proofSourceLabel,
          proofRangeLabel,
          rankingSignalLabel,
          rankingSignalDescription,
        }),
      });

      if (!response.ok) {
        alert(isZh ? '爆款文案生成失败，请重试' : 'Caption generation failed, please try again');
        setIsGeneratingCaptions(false);
        return;
      }

      const result = await response.json() as { content?: string };
      setAiCaptions(parseCaptionOptions(result.content ?? '').slice(0, 3));
    } catch (err) {
      console.error('AI caption generation failed:', err);
      alert(isZh ? '生成失败，请检查网络' : 'Generation failed, check network');
    } finally {
      setIsGeneratingCaptions(false);
    }
  }, [
    activeMetaphor,
    data.locale,
    data.platform,
    data.primaryProjectName,
    data.primaryProjectPitch,
    data.projects,
    data.proofSource,
    data.slogan,
    data.totalTokens,
    data.trustTier,
    data.username,
    isZh,
    proofRangeLabel,
    proofSourceLabel,
    rankingSignalDescription,
    rankingSignalLabel,
    trustTierLabel,
  ]);

  const handleGenerateSlogan = useCallback(async () => {
    if (data.totalTokens <= 0) return;

    setIsGeneratingSlogan(true);
    setAiSlogans([]);
    try {
      const response = await fetch('/api/generate-slogan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username || data.primaryProjectName || 'builder',
          tokens: data.totalTokens,
          locale: data.locale,
          style: isZh ? 'hype' : 'flex',
          titleMode: 'personal',
          primaryProjectName: data.primaryProjectName,
          primaryProjectPitch: data.primaryProjectPitch,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { content?: string };
      setAiSlogans(parseAIOptions(result.content ?? '').slice(0, 3));
    } catch (err) {
      console.error('AI slogan generation failed:', err);
    } finally {
      setIsGeneratingSlogan(false);
    }
  }, [data.locale, data.primaryProjectName, data.primaryProjectPitch, data.totalTokens, data.username, isZh]);

  const handleGeneratePitch = useCallback(async () => {
    setIsGeneratingPitch(true);
    setAiPitches([]);
    try {
      const response = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: data.primaryProjectName || data.projects[0]?.name || 'project',
          projectUrl: data.primaryProjectUrl || data.projects[0]?.url || '',
          tokens: data.totalTokens,
          locale: data.locale,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { content?: string };
      setAiPitches(parseAIOptions(result.content ?? '').slice(0, 3));
    } catch (err) {
      console.error('AI pitch generation failed:', err);
      alert(isZh ? '生成失败，请检查网络' : 'Generation failed, check network');
    } finally {
      setIsGeneratingPitch(false);
    }
  }, [data.primaryProjectName, data.primaryProjectUrl, data.totalTokens, data.locale, data.projects, isZh]);

  useEffect(() => {
    if (step !== 3 || data.totalTokens <= 0 || data.slogan.trim() || aiSlogans.length > 0 || isGeneratingSlogan) return;
    void handleGenerateSlogan();
  }, [aiSlogans.length, data.slogan, data.totalTokens, handleGenerateSlogan, isGeneratingSlogan, step]);

  useEffect(() => {
    if (step !== 4 || data.totalTokens <= 0 || aiCaptions.length > 0 || isGeneratingCaptions) return;
    void handleGenerateCaptions();
  }, [aiCaptions.length, data.totalTokens, handleGenerateCaptions, isGeneratingCaptions, step]);

  const handleTokenInput = useCallback((raw: string) => {
    setTokenInput(raw);
    updateField('totalTokens', parseTokenValue(raw));
  }, [updateField]);

  const normalizeTokenInputDisplay = useCallback(() => {
    if (data.totalTokens > 0) {
      setTokenInput(formatTokens(data.totalTokens, data.locale));
    }
  }, [data.locale, data.totalTokens]);

  const handleAvatarTypeChange = useCallback((type: CardData['avatarType']) => {
    setData(prev => {
      if (prev.avatarType === type) return prev;

      if (type === 'emoji') {
        return {
          ...prev,
          avatarType: type,
          avatarValue: prev.avatarType === 'emoji' && prev.avatarValue ? prev.avatarValue : '🤖',
        };
      }

      if (type === 'photo') {
        return {
          ...prev,
          avatarType: type,
          avatarValue: prev.avatarValue.startsWith('data:image') ? prev.avatarValue : '',
        };
      }

      if (type === 'github') {
        const githubUsername = prev.avatarValue.match(/github\.com\/([^/.]+)\.png/)?.[1] || prev.username.trim();
        return {
          ...prev,
          avatarType: type,
          avatarValue: githubUsername ? `https://github.com/${githubUsername}.png` : '',
        };
      }

      return {
        ...prev,
        avatarType: type,
        avatarValue: `https://api.dicebear.com/9.x/adventurer/svg?seed=${prev.username || 'tokcard'}`,
      };
    });
  }, []);

  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const validateImageFile = useCallback((file: File): string | null => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return isZh ? '仅支持 JPEG/PNG/WebP/GIF 格式' : 'Only JPEG/PNG/WebP/GIF images allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
      return isZh ? '文件大小不能超过 5MB' : 'File must be under 5 MB';
    }
    return null;
  }, [isZh]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      alert(error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateField('avatarValue', event.target.result as string);
      }
    };
    reader.onerror = () => {
      alert(isZh ? '文件读取失败，请重试' : 'Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleProofFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files ?? []);
    const ALLOWED_PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const MAX_PROOF_SIZE = 10 * 1024 * 1024; // 10 MB

    const validFiles = rawFiles.filter((file) => {
      if (!ALLOWED_PROOF_TYPES.has(file.type)) return false;
      if (file.size > MAX_PROOF_SIZE) return false;
      return true;
    });

    const files = validFiles.map((file) => ({
      name: file.name,
      size: file.size,
    }));

    if (rawFiles.length > 0 && validFiles.length === 0) {
      setProofFeedback(isZh ? '仅支持 JPEG/PNG/WebP/GIF 格式，且不超过 10MB。' : 'Only JPEG/PNG/WebP/GIF under 10MB allowed.');
      return;
    }

    setProofFiles(files);
    setProofFeedback(files.length > 0
      ? (isZh ? `已选择 ${files.length} 张截图，可标记为"截图佐证"。` : `${files.length} screenshot(s) selected. You can now mark the card as proof attached.`)
      : null);
  }, [isZh]);

  const applyScreenshotBackedTrust = useCallback(() => {
    if (proofFiles.length === 0) {
      setProofFeedback(isZh ? '请先选择 usage 或账单截图。' : 'Select a usage or billing screenshot first.');
      return;
    }

    setData((prev) => ({
      ...prev,
      trustTier: 'screenshot-backed',
      importedAt: new Date().toISOString(),
    }));
    setProofFeedback(isZh ? '这张卡已升级为"截图佐证"，分享时会带上可信标签。' : 'This card is now marked as proof attached and will carry a trust label when shared.');
  }, [isZh, proofFiles.length]);

  const handleImportUsageRecord = useCallback(() => {
    const trimmed = usageImportText.trim();
    if (!trimmed) {
      setProofFeedback(isZh ? '先粘贴一段 usage 文本、账单摘要或导出内容。' : 'Paste a usage summary, billing excerpt, or export first.');
      return;
    }

    const detectedSource = detectProofSourceFromText(trimmed);
    const detectedValues = extractImportedTokenValues(trimmed);
    const nextTotalTokens = detectedValues[0] ?? data.totalTokens;
    const nextLastMonthTokens = detectedValues[1] ?? data.lastMonthTokens;

    if (!nextTotalTokens) {
      setProofFeedback(isZh ? '暂时没识别出 token 数字。你可以先在上面手动填写，再点击导入。' : 'No token value was detected yet. Fill the token field above first, then import again.');
      return;
    }

    setData((prev) => ({
      ...prev,
      totalTokens: nextTotalTokens,
      lastMonthTokens: nextLastMonthTokens,
      trustTier: 'usage-imported',
      proofSource: prev.proofSource ?? detectedSource,
      importedAt: new Date().toISOString(),
    }));
    setTokenInput(formatTokens(nextTotalTokens, data.locale));
    setProofFeedback(isZh
      ? `已按导入记录更新为 ${formatTokens(nextTotalTokens, data.locale)}，并切换到“数据导入”状态。`
      : `Updated the card to ${formatTokens(nextTotalTokens, data.locale)} and switched it to usage-imported status.`);
  }, [data.lastMonthTokens, data.locale, data.totalTokens, isZh, usageImportText]);

  const resetTrustState = useCallback(() => {
    setData((prev) => ({
      ...prev,
      trustTier: 'self-reported',
      proofSource: undefined,
      proofDateRange: undefined,
      importedAt: undefined,
    }));
    setProofFiles([]);
    setUsageImportText('');
    setProofFeedback(isZh ? '已恢复为默认的"用户填写"状态。' : 'Reverted the card to self-reported status.');
  }, [isZh]);

  const downloadViaLink = useCallback((url: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.rel = 'noopener';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const waitForImagesToSettle = useCallback(async (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll('img'));

    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };

          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });

          if (typeof img.decode === 'function') {
            img.decode().then(finish).catch(finish);
          }

          window.setTimeout(finish, 2500);
        });
      })
    );
  }, []);

  const buildShareCaption = useCallback(() => {
    const selectedAiCaption = sortedAiCaptions[0];
    if (selectedAiCaption) {
      return [selectedAiCaption.title, selectedAiCaption.body, selectedAiCaption.hashtags.join(' ')].filter(Boolean).join('\n');
    }

    const tokenText = data.totalTokens > 0 ? formatTokens(data.totalTokens, data.locale) : '0';
    const projectLabel = data.primaryProjectName.trim();
    const projectPitch = data.primaryProjectPitch.trim();
    return isZh
      ? [
          `${data.username || '我'}本月烧了 ${tokenText} token`,
          projectLabel ? `项目：${projectLabel}` : '',
          projectPitch || activeMetaphor,
          rankingSignalLabel,
          '#TokCard #AI战绩',
        ].filter(Boolean).join('\n')
      : [
          `${data.username || 'I'} burned ${tokenText} AI tokens this month`,
          projectLabel ? `Project: ${projectLabel}` : '',
          projectPitch || activeMetaphor,
          rankingSignalLabel,
          '#TokCard #AIBuilders',
        ].filter(Boolean).join('\n');
  }, [activeMetaphor, data.locale, data.primaryProjectName, data.primaryProjectPitch, data.totalTokens, data.username, isZh, rankingSignalLabel, sortedAiCaptions]);
  const recommendedAiCaption = useMemo(() => sortedAiCaptions[0] ?? null, [sortedAiCaptions]);
  const recommendedCaptionText = useMemo(() => (
    recommendedAiCaption
      ? [recommendedAiCaption.title, recommendedAiCaption.body, recommendedAiCaption.hashtags.join(' ')].filter(Boolean).join('\n')
      : ''
  ), [recommendedAiCaption]);
  const recommendedCaptionMeta = useMemo(() => (
    recommendedAiCaption ? getCaptionTrustMeta(recommendedAiCaption.vibe, data.trustTier, data.locale) : null
  ), [data.locale, data.trustTier, recommendedAiCaption]);
  const activeShareCaption = shareCaption || buildShareCaption();
  const isUsingRecommendedCaption = Boolean(recommendedCaptionText) && activeShareCaption === recommendedCaptionText;
  const shareLinkMeta = useMemo(() => {
    if (!shareLink) return null;

    const buildMeta = (display: string) => ({
      full: shareLink,
      display,
      isCompacted: display !== shareLink,
    });

    try {
      const parsed = new URL(shareLink);
      const ref = parsed.searchParams.get('ref');
      const looksEncodedShare = parsed.pathname === '/u' && parsed.searchParams.has('d');

      if (looksEncodedShare) {
        return buildMeta(`${parsed.origin}${parsed.pathname}?d=…${ref ? `&ref=${ref}` : ''}`);
      }
    } catch {
      // Fall through to length-based compaction.
    }

    return buildMeta(shareLink.length > 96 ? `${shareLink.slice(0, 92)}…` : shareLink);
  }, [shareLink]);

  const flashCopyFeedback = useCallback((type: 'caption' | 'link') => {
    setCopyFeedback(type);
    window.setTimeout(() => {
      setCopyFeedback((current) => (current === type ? null : current));
    }, 2000);
  }, []);

  const flashExportNotice = useCallback((message: string, tone: 'neutral' | 'success' | 'error' = 'neutral', duration = 2800) => {
    setExportNotice(message);
    setExportNoticeTone(tone);
    if (exportNoticeTimeoutRef.current) {
      window.clearTimeout(exportNoticeTimeoutRef.current);
    }
    exportNoticeTimeoutRef.current = window.setTimeout(() => {
      setExportNotice((current) => (current === message ? null : current));
      exportNoticeTimeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => () => {
    if (exportNoticeTimeoutRef.current) {
      window.clearTimeout(exportNoticeTimeoutRef.current);
    }
  }, []);

  const handleCopyShareCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareCaption || buildShareCaption());
      flashCopyFeedback('caption');
    } catch (err) {
      console.error('Copy failed:', err);
      flashExportNotice(isZh ? '复制失败，请手动复制。' : 'Copy failed. Please copy it manually.', 'error');
    }
  }, [buildShareCaption, flashCopyFeedback, flashExportNotice, isZh, shareCaption]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      flashCopyFeedback('link');
    } catch (err) {
      console.error('Copy failed:', err);
      flashExportNotice(isZh ? '复制失败，请手动复制。' : 'Copy failed. Please copy it manually.', 'error');
    }
  }, [flashCopyFeedback, flashExportNotice, isZh, shareLink]);

  const handleExport = useCallback(async () => {
    if (exportIssues.length > 0) {
      setShowValidation(true);
      flashExportNotice(isZh ? '请先补齐导出所需内容。' : 'Complete the required export items before exporting.', 'neutral');
      return;
    }

    if (!isPreviewReady) {
      flashExportNotice(isZh ? '图片还在同步，稍等一下再导出。' : 'Images are still syncing. Export again in a moment.', 'neutral');
      return;
    }

    setExportNotice(null);
    setExportNoticeTone('neutral');
    setIsExporting(true);
    setExportProgress(8);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      setExportProgress(20);

      const cardWithRef = { ...data, referralCode: sanitizeReferralCode(data.referralCode || data.username || data.primaryProjectName) };
      const nextShareCaption = shareCaption || buildShareCaption();
      const shortResult = await saveCardAndGetShortUrl(cardWithRef, window.location.origin);
      const nextShareLink = shortResult?.shortUrl
        ?? buildSharedCardUrl(cardWithRef, window.location.origin)
        ?? window.location.origin;
      const nextCardId = shortResult?.cardId ?? '';
      const nextExportCard = { ...cardWithRef, qrcodeUrl: nextShareLink };

      setShareCardId(nextCardId);
      setExportCardSnapshot(nextExportCard);
      setExportProgress(36);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const el = document.getElementById(exportRenderId);
      if (!el) throw new Error('Export canvas not found');

      await waitForImagesToSettle(el);
      setExportProgress(52);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      setExportProgress(68);

      const blob = await domToBlob(el, {
        scale: 2,
        fetch: { bypassingCache: false },
        font: { preferredFormat: 'woff2' },
        features: {
          removeControlCharacter: true,
        },
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });
      setExportProgress(80);

      if (!blob) throw new Error('Generation failed: null blob');

      const filename = `tokcard-${data.username || data.primaryProjectName || 'card'}-${data.platform}.png`;
      let shared = false;

      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const file = new File([blob], filename, { type: 'image/png' });

      if (isMobileDevice && navigator.canShare?.({ files: [file] })) {
        try {
          await shareWithFallback({
            files: [file],
            title: 'TokCard',
            text: nextShareCaption,
            url: nextShareLink || undefined,
          });
          shared = true;
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            setIsExporting(false);
            setExportProgress(0);
            return;
          }
          console.warn('Share API failed, falling back:', err);
        }
      }

      if (!shared) {
        const objectUrl = URL.createObjectURL(blob);
        downloadViaLink(objectUrl, filename);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
        const notice = isZh ? '图片已下载，可继续复制文案或分享链接。' : 'Image downloaded. You can now copy the caption or share link.';
        flashExportNotice(notice, 'success');
      }

      setExportProgress(100);
      setShowSuccessAnimation(true);
      window.setTimeout(() => setShowSuccessAnimation(false), 2800);
      setShareCaption(nextShareCaption);
      setShareLink(nextShareLink);
      setCopyFeedback(null);
      setShowShareSheet(true);

    } catch (err) {
      console.error('Export failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      flashExportNotice(
        isZh
          ? `下载失败：${errMsg}。可尝试更换浏览器，或先把头像改成 Emoji 后重试。`
          : `Export failed: ${errMsg}. Try another browser, or switch the avatar to an emoji and retry.`,
        'error',
        4200,
      );
    } finally {
      setExportCardSnapshot(null);
      setIsExporting(false);
      window.setTimeout(() => setExportProgress(0), 1500);
    }
  }, [buildShareCaption, data, downloadViaLink, exportIssues, exportRenderId, flashExportNotice, isPreviewReady, isZh, shareCaption, waitForImagesToSettle]);

  const showMobileSheet = isMobile && step !== 4;

  const mobileBottomBar = (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 px-4 pt-2 bg-gradient-to-t from-[#fbfbfd] via-[#fbfbfd] to-transparent" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="flex gap-2">
        {step === 4 ? (
          <>
            <button type="button" onClick={() => setStep(nextMobileEditStep)}
              className="px-5 py-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] font-semibold">
              {fieldErrors.tokens ? (isZh ? '开始填写' : 'Start editing') : (isZh ? '继续编辑' : 'Edit')}
            </button>
            <button type="button" onClick={handleExport} disabled={isExporting || !canExport || !isPreviewReady}
              className="flex-1 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20 disabled:opacity-60">
              {isExporting
                ? (isZh ? '生成中...' : 'Generating...')
                : !canExport
                  ? (isZh ? '补齐后出图' : 'Complete before export')
                  : (isZh ? '立即出图' : 'Export Now')}
            </button>
          </>
        ) : step === 1 ? (
          <button type="button" onClick={() => setStep(2)}
            className="flex-1 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20">
            {isZh ? '下一步：项目' : 'Next: project'}
          </button>
        ) : step === 2 ? (
          <>
            <button type="button" onClick={() => setStep(1)}
              className="px-5 py-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] font-semibold">
              {isZh ? '返回' : 'Back'}
            </button>
            <button type="button" onClick={() => setStep(3)}
              className="flex-1 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20">
              {isZh ? '下一步：风格' : 'Next: style'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setStep(2)}
              className="px-5 py-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] font-semibold">
              {isZh ? '返回' : 'Back'}
            </button>
            <button type="button" onClick={() => setStep(4)}
              className="flex-1 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20">
              {isZh ? '预览并导出' : 'Preview & Export'}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-[#1d1d1f] bg-[#fbfbfd] selection:bg-[#0071e3] selection:text-white">
      <SuccessAnimation show={showSuccessAnimation} duration={2800} locale={isZh ? 'zh' : 'en'} />
      {exportNotice && (
        <div className={`fixed left-1/2 top-5 z-[71] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-medium shadow-[0_16px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl ${exportNoticeTone === 'error'
          ? 'border border-[#fecaca] bg-[#7f1d1d]/92 text-white'
          : exportNoticeTone === 'success'
            ? 'border border-[#bbf7d0] bg-[#14532d]/92 text-white'
            : 'border border-white/20 bg-[#0f172a]/92 text-white'}` }>
          {exportNotice}
        </div>
      )}
      {/* Header */}
      <header className="px-6 py-5 border-b border-[#d2d2d7]/30 bg-[#fbfbfd]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
            TokCard
          </a>
          <button type="button"
            onClick={() => updateField('locale', isZh ? 'en' : 'zh')}
            className="text-sm font-medium transition-colors px-4 py-1.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
          >
            {isZh ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isMobile && mobileBottomBar}
        {showMobileSheet && (
          <button
            type="button"
            aria-label={isZh ? '关闭编辑面板并返回预览' : 'Close editor and return to preview'}
            onClick={() => setStep(4)}
            className="lg:hidden fixed inset-0 z-[35] bg-[#0f172a]/38 backdrop-blur-sm"
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">
          {/* Left: Form */}
          <div className={`min-w-0 ${showMobileSheet ? 'fixed inset-x-0 bottom-0 z-40 max-h-[78vh] overflow-y-auto rounded-t-[28px] border border-[#dbe4ff] bg-[#fbfbfd]/96 px-4 pt-4 pb-32 shadow-[0_-28px_90px_rgba(15,23,42,0.30)] backdrop-blur-xl' : 'hidden'} lg:block lg:space-y-8 lg:relative lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0 lg:shadow-none`}>
            {showMobileSheet && (
              <div className="mb-4 lg:hidden">
                <div className="mx-auto h-1.5 w-16 rounded-full bg-[#cbd5e1] shadow-[0_1px_0_rgba(255,255,255,0.7)]" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '编辑卡片' : 'Edit card'}</div>
                    <div className="mt-1 text-sm font-medium text-[#475569]">{step === 1 ? (isZh ? '先填昵称与 Token' : 'Start with name and tokens') : step === 2 ? (isZh ? '再补项目信息' : 'Then add the project') : (isZh ? '再定风格与可信度' : 'Then set style and trust')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-sm font-medium text-[#475569]"
                  >
                    {isZh ? '回到预览' : 'Preview'}
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6 rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? 'TokCard 关键词' : 'TokCard keywords'}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium text-[#475569]">
                <span className="rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5">{isZh ? 'Token' : 'Tokens'}</span>
                <span className="rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5">{isZh ? '项目' : 'Project'}</span>
                <span className="rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5">{isZh ? '排名' : 'Rank'}</span>
                <span className="rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5">{isZh ? '分享' : 'Share'}</span>
              </div>
            </div>

            {/* Step indicator */}
            <div className={`${showMobileSheet ? 'lg:flex' : ''} flex flex-wrap items-center gap-3 mb-6`}>
              {([
                { value: 1, labelZh: '昵称与 Token', labelEn: 'Name & token' },
                { value: 2, labelZh: '项目', labelEn: 'Project' },
                { value: 3, labelZh: '风格', labelEn: 'Style' },
                { value: 4, labelZh: '导出', labelEn: 'Export' },
              ] as const).map((item) => (
                <button key={item.value} type="button" onClick={() => setStep(item.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    step === item.value ? 'bg-[#0071e3] text-white shadow-lg shadow-[#0071e3]/20' : 'bg-[#f5f5f7] text-[#86868b]'
                  }`}>
                  <span>{item.value}</span>
                  <span className="hidden sm:inline">{isZh ? item.labelZh : item.labelEn}</span>
                </button>
              ))}
            </div>

            {/* ===== STEP 1: Core Card Information ===== */}
            {step === 1 && (<>
            <div className="mb-6 rounded-[24px] border border-[#dbe4ff] bg-[#f8fbff] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? 'Step 1 · 昵称与战绩' : 'Step 1 · Name and token'}</div>
              <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{isZh ? '先让别人记住你，再看你的 Token。' : 'Let people remember you first, then see the token signal.'}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                  {isZh ? '你的昵称' : 'Your handle'}
                </label>
                <input
                  type="text"
                  value={data.username}
                  onChange={e => updateField('username', e.target.value)}
                  placeholder={isZh ? '例如：Ralph / Allen / Builder' : 'e.g. Allen / Ralph / Builder'}
                  maxLength={64}
                  className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
                />
                <p className="mt-2 text-xs text-[#94a3b8]">{isZh ? '这是别人第一眼记住你的名字。' : 'This is the first name people remember on the card.'}</p>
              </div>
              <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '总 Token 用量' : 'Total Token Usage'}
              </label>
              <input
                type="text"
                value={tokenInput}
                onChange={e => handleTokenInput(e.target.value)}
                onBlur={normalizeTokenInputDisplay}
                placeholder={isZh ? '例如：2.3B / 500M / 10万 / 3千' : 'e.g. 2.3B / 500M / 10K'}
                className={`w-full px-4 py-3.5 bg-white border rounded-xl text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm ${showValidation && fieldErrors.tokens ? 'border-red-400' : 'border-[#d2d2d7]'}`}
              />
              {tokenInput.trim() && data.totalTokens <= 0 && (
                <p className="mt-2 text-xs text-red-500">{isZh ? '无法识别，请用数字或 K/M/B/万/亿/千' : 'Unrecognized format. Use numbers or K/M/B/K units.'}</p>
              )}
              <p className="mt-2 text-xs text-[#86868b]">
                {isZh ? '默认自动收敛成更短的单位显示，避免一长串 0。' : 'The field auto-normalizes into shorter units so you do not stare at long zero-heavy numbers.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {([
                  { label: '轻度玩家', labelEn: 'Casual', value: '10M' },
                  { label: '中度用户', labelEn: 'Regular', value: '120M' },
                  { label: '重度开发者', labelEn: 'Heavy', value: '500M' },
                  { label: '骨灰级', labelEn: 'Power User', value: '2.3B' },
                ] as const).map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleTokenInput(preset.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      tokenInput === preset.value
                        ? 'border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3]'
                        : 'border-[#dbe4ff] bg-white text-[#334155] hover:border-[#0071e3] hover:text-[#0071e3]'
                    }`}
                  >
                    {isZh ? preset.label : preset.labelEn} ({preset.value})
                  </button>
                ))}
              </div>
            </div>

            {/* Step 1 navigation — desktop only, mobile uses sticky bar */}
            <div className="hidden lg:flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(2)}
                className="flex-1 px-6 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20 hover:opacity-95">
                {isZh ? '下一步：填写项目' : 'Next: Project details'}
              </button>
            </div>
            </div>
            </>)}

            {step === 2 && (<>
            <div className="mb-6 rounded-[24px] border border-[#dbe4ff] bg-[#f8fbff] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? 'Step 2 · 再带出项目感' : 'Step 2 · Show the project'}</div>
              <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{isZh ? '让别人一眼知道你在做什么，以及为什么值得点开。' : 'Tell people what you are building and why it deserves a click.'}</div>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">{isZh ? '项目名、项目一句话和项目入口，是这张名片第二重要的层次。' : 'Project name, pitch, and destination are the second most important layer of the card.'}</p>
            </div>

            {/* Primary Project */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '主项目名称' : 'Primary Project Name'}
              </label>
              <input
                type="text"
                value={data.primaryProjectName}
                onChange={e => updateField('primaryProjectName', e.target.value)}
                placeholder={isZh ? '例如：TokCard' : 'e.g. TokCard'}
                maxLength={64}
                className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
              />
              <div className="mt-1 text-right text-xs text-[#94a3b8]">{data.primaryProjectName.length}/64</div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '主项目 URL' : 'Primary Project URL'}
              </label>
              <input
                type="url"
                value={data.primaryProjectUrl}
                onChange={e => updateField('primaryProjectUrl', e.target.value)}
                placeholder={isZh ? '例如：https://tokcard.dev' : 'e.g. https://tokcard.dev'}
                maxLength={512}
                className={`w-full px-4 py-3.5 bg-white border rounded-xl text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm ${showValidation && fieldErrors.project ? 'border-red-400' : 'border-[#d2d2d7]'}`}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '主项目一句话介绍' : 'Primary Project Pitch'}
              </label>
              <input
                type="text"
                value={data.primaryProjectPitch}
                onChange={e => updateField('primaryProjectPitch', e.target.value)}
                placeholder={isZh ? '例如：用 AI 打造的可信战绩展示平台' : 'e.g. A trusted proof platform for AI-powered builders'}
                maxLength={200}
                className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
              />
              <div className="mt-1 text-right text-xs text-[#94a3b8]">{data.primaryProjectPitch.length}/200</div>

              {/* AI Pitch Generation */}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleGeneratePitch}
                  disabled={isGeneratingPitch || (!data.primaryProjectName.trim() && !data.primaryProjectUrl.trim())}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-opacity disabled:opacity-50 flex items-center gap-1 bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20"
                >
                  {isGeneratingPitch ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '✨ 生成 3 条项目介绍' : '✨ Generate 3 pitches')}
                </button>
              </div>

              {aiPitches.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-white border border-[#0071e3]/30 shadow-sm">
                  <div className="text-xs font-medium mb-3 text-[#0071e3]">{isZh ? 'AI 生成的项目介绍 (点击应用)' : 'AI Generated Pitches (tap to apply)'}</div>
                  <div className="flex flex-col gap-2">
                    {aiPitches.map((pitch, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => updateField('primaryProjectPitch', pitch)}
                        className="text-left p-3 rounded-lg border border-[#d2d2d7] hover:border-[#0071e3]/50 hover:bg-[#0071e3]/5 transition-all text-sm text-[#1d1d1f]"
                      >
                        {pitch}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(1)}
                className="px-6 py-3.5 rounded-xl border border-[#d2d2d7] text-[#1d1d1f] font-semibold hover:bg-[#f5f5f7]">
                {isZh ? '返回 Token' : 'Back to token'}
              </button>
              <button type="button" onClick={() => setStep(3)}
                className="flex-1 px-6 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20 hover:opacity-95">
                {isZh ? '下一步：风格与可信度' : 'Next: Style & trust'}
              </button>
            </div>
            </>)}

            {step === 3 && (<>
            <div className="mb-6 rounded-[24px] border border-[#dbe4ff] bg-[#f8fbff] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? 'Step 3 · 风格与可信度' : 'Step 3 · Style and trust'}</div>
              <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{isZh ? '这一步只决定形象、签名和可信状态。' : 'This step only shapes style, signature, and trust.'}</div>
            </div>
            <div className="space-y-8 rounded-[24px] border border-[#dbe4ff] bg-white px-5 py-6 shadow-sm">

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wide">{isZh ? '精选模板' : 'Curated templates'}</div>
                  <div className="mt-1 text-xs text-[#94a3b8]">{isZh ? '先按发帖平台选，再选最贴近你这次传播语气的版本。' : 'Pick the target platform first, then choose the mood that matches this post.'}</div>
                </div>
              </div>
              <div className="space-y-4">
                {presetGroups.map((group) => (
                  <div key={group.platform} className="rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#1d1d1f]">{group.label}</div>
                        <div className="mt-1 text-xs leading-5 text-[#64748b]">{group.note}</div>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
                        {group.presets.length} {isZh ? '套风格' : 'styles'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {group.presets.map((preset: CardPreset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset.id)}
                          className="rounded-[22px] border border-[#dbe4ff] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#0071e3] hover:shadow-[0_16px_30px_rgba(0,113,227,0.10)]"
                        >
                          <div
                            className={`rounded-[18px] px-4 py-4 ${preset.previewTone === 'light' ? 'text-[#0f172a]' : 'text-white'}`}
                            style={{
                              background: preset.preview,
                              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 14px 28px ${preset.accent}26`,
                            }}
                          >
                            <div className={`flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${preset.previewTone === 'light' ? 'text-[#475569]' : 'text-white/80'}`}>
                              <span>{preset.emoji}</span>
                              <span>{isZh ? PLATFORMS[preset.platform].labelZh : PLATFORMS[preset.platform].label}</span>
                            </div>
                            <div className={`mt-7 text-base font-semibold ${preset.previewTone === 'light' ? 'text-[#0f172a]' : 'text-white'}`}>{isZh ? preset.name : preset.nameEn}</div>
                            <div className={`mt-1 text-xs leading-5 ${preset.previewTone === 'light' ? 'text-[#334155]' : 'text-white/78'}`}>{isZh ? preset.description : preset.descriptionEn}</div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 px-1">
                            <span className="text-xs font-medium text-[#475569]">{isZh ? '一键套用平台语境' : 'Apply platform context'}</span>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm" style={{ backgroundColor: preset.accent }}>→</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wide">{isZh ? '一句话签名' : 'Signature'}</div>
                  <div className="mt-1 text-xs text-[#94a3b8]">{isZh ? '先给你 3 条 AI 候选，不够就继续刷新。' : 'Start with 3 AI options and regenerate when needed.'}</div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSlogan}
                  disabled={isGeneratingSlogan || data.totalTokens <= 0}
                  className="rounded-full bg-[#111827] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isGeneratingSlogan ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '再来一组' : 'Regenerate')}
                </button>
              </div>
              <input
                type="text"
                value={data.slogan}
                onChange={e => updateField('slogan', e.target.value)}
                placeholder={isZh ? '签名会显示在卡片里' : 'This line appears inside the card'}
                maxLength={60}
                className="mt-4 w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
              />
              {aiSlogans.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {aiSlogans.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => updateField('slogan', option)}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition-all ${data.slogan === option ? 'border-[#0071e3] bg-[#eef5ff] text-[#0071e3]' : 'border-[#dbe4ff] bg-white text-[#334155] hover:border-[#0071e3]'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <details className="rounded-[24px] border border-[#e5e7eb] bg-[#fafafa] px-4 py-4">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '头像与身份' : 'Avatar and identity'}</div>
                    <div className="mt-1 text-sm text-[#64748b]">{isZh ? '这里保留头像和身份的小幅调整，默认不抢主流程注意力。' : 'Keep avatar and identity tuning here so the main flow stays visually clean.'}</div>
                  </div>
                  <span className="text-xs font-semibold text-[#94a3b8]">{isZh ? '展开' : 'Open'}</span>
                </div>
              </summary>
              <div className="mt-5 space-y-6">

            {/* Avatar */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '头像' : 'Avatar'}
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(['emoji', 'github', 'cartoon', 'photo'] as const).map(type => (
                  <button type="button"
                    key={type}
                    onClick={() => handleAvatarTypeChange(type)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${data.avatarType === type ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'}`}
                  >
                    {type === 'emoji' ? 'Emoji' : type === 'github' ? 'GitHub' : type === 'photo' ? (isZh ? '上传图片' : 'Upload') : (isZh ? '卡通' : 'Cartoon')}
                  </button>
                ))}
              </div>

              {data.avatarType === 'emoji' && (
                <div className="flex flex-wrap gap-2">
                  {PRESET_EMOJIS.map(emoji => (
                    <button type="button"
                      key={emoji}
                      onClick={() => updateField('avatarValue', emoji)}
                      className={`w-12 h-12 rounded-full text-2xl flex items-center justify-center transition-all ${data.avatarValue === emoji ? 'bg-[#0071e3]/10 border-2 border-[#0071e3]' : 'bg-white border border-[#d2d2d7] hover:bg-[#f5f5f7]'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {data.avatarType === 'github' && (
                <input
                  type="text"
                  value={data.avatarValue.replace('https://github.com/', '').replace('.png', '')}
                  onChange={e => {
                    const gh = e.target.value;
                    updateField('avatarValue', gh ? `https://github.com/${gh}.png` : '');
                  }}
                  placeholder="GitHub username"
                  className="w-full px-4 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3]"
                />
              )}
              
              {data.avatarType === 'photo' && (
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <button type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] font-medium hover:bg-[#f5f5f7] transition-colors"
                  >
                    {isZh ? '选择图片...' : 'Choose Image...'}
                  </button>
                  {data.avatarValue && data.avatarValue.startsWith('data:image') && (
                    <img src={data.avatarValue} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-[#d2d2d7]" />
                  )}
                </div>
              )}

              {data.avatarType === 'cartoon' && (
                <div className="flex flex-wrap gap-2">
                  {['adventurer', 'avataaars', 'bottts', 'fun-emoji', 'lorelei', 'pixel-art'].map(style => (
                    <button type="button"
                      key={style}
                      onClick={() => updateField('avatarValue', `https://api.dicebear.com/9.x/${style}/svg?seed=${data.username || 'tokcard'}`)}
                      className="px-4 py-2 bg-white border border-[#d2d2d7] rounded-full text-sm font-medium hover:bg-[#f5f5f7] transition-colors"
                    >
                      {style}
                    </button>
                  ))}
                </div>
              )}
            </div>

              </div>
            </details>

            {/* Theme */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '卡片主题' : 'Card Theme'}
              </label>
                <div className="grid gap-3 sm:grid-cols-3">
                {CURATED_THEME_OPTIONS.map((theme) => (
                  <button type="button"
                    key={theme.value}
                    onClick={() => updateField('theme', theme.value)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${data.theme === theme.value ? 'border-[#0071e3] bg-[#0071e3]/5 ring-4 ring-[#0071e3]/10' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'}`}
                  >
                    <div className={`w-full h-8 rounded-lg mb-2 ${theme.preview} border`} />
                    <span className="text-sm font-medium text-[#1d1d1f]">{isZh ? theme.labelZh : theme.labelEn}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#86868b]">
                {isZh ? '只保留 3 个最经典的方案：深色高级、纯白极简、柔雾专业。' : 'Only 3 classic directions remain: premium dark, pure white, and soft minimal.'}
              </p>
            </div>

            <div className="rounded-[24px] border border-[#e2e8f0] bg-[#fafcff] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '已降级的低频设置' : 'Low-frequency controls demoted'}</div>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">
                {isZh ? '这轮把模型分布、比喻风格、上月 token 等低频项降到更低优先级，先让模板、项目、可信度和分享结果更清楚。' : 'This round intentionally demotes low-frequency controls like model mix, metaphor style, and last-month tokens so templates, project story, trust, and sharing stay clearer.'}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '我的链接' : 'My links'}</div>
                <div className="mt-2 text-sm leading-6 text-[#64748b]">{isZh ? '把最重要的项目入口放这里。第一个链接会生成卡片二维码，也会成为分享页的主入口。' : 'Put the most important project destinations here. The first link becomes both the QR code target and the main shared destination.'}</div>
                <div className="mt-4 space-y-3">
                  {ensureProjectSlots.map((project, index) => (
                    <div key={project.id} className="flex items-center gap-2">
                      <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f5f7fb] text-sm flex-shrink-0">
                        {project.icon || '🔗'}
                      </span>
                      <input
                        type="url"
                        value={project.url}
                        onChange={e => handleProjectUrlChange(index, e.target.value)}
                        placeholder={index === 0
                          ? (isZh ? '主项目链接（如官网 / GitHub）' : 'Primary project link (site or GitHub)')
                          : (isZh ? '补充链接（选填）' : 'Additional link (optional)')
                        }
                        className="flex-1 px-4 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all text-sm"
                      />
                    </div>
                  ))}
                </div>
                {ensureProjectSlots[0]?.url && (
                  <div className="mt-3 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-xs leading-5 text-[#64748b]">
                    {isZh ? '导出后会自动带上 TokCard 二维码和分享链接，别人可以先看卡片，再点进你的项目。' : 'Export will automatically carry a TokCard QR and share link so people can see the card first, then open your project.'}
                  </div>
                )}
                {ensureProjectSlots[0]?.url && !primaryProjectUrl && (
                  <div className={`mt-3 rounded-2xl border px-4 py-3 text-xs leading-5 ${showValidation ? 'border-red-400 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {isZh ? '当前主项目链接不是有效的 http/https 地址，导出和分享前请修正。' : 'The primary project link is not a valid http/https URL. Fix it before exporting.'}
                  </div>
                )}
                {showValidation && fieldErrors.project && !ensureProjectSlots[0]?.url && (
                  <div className="mt-3 rounded-2xl border border-red-400 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                    {isZh ? '请至少添加一个项目链接' : 'Add at least one project link'}
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '可信等级与进榜' : 'Trust and ranking access'}</div>
                      <div className="mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold" style={{ color: trustTierAccent, borderColor: `${trustTierAccent}33`, backgroundColor: `${trustTierAccent}12` }}>
                        {trustTierLabel}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-3 text-sm font-medium text-[#334155]">
                      {rankingAccessGuide.title}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-3 text-sm text-[#475569]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '当前状态' : 'Current state'}</div>
                      <div className="mt-2">{trustTierDescription}</div>
                      {(data.proofSource || proofRangeLabel) && (
                        <div className="mt-2 text-xs text-[#64748b]">
                          {[data.proofSource ? proofSourceLabel : '', proofRangeLabel].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-3 text-sm text-[#475569]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '下一步' : 'Next step'}</div>
                      <div className="mt-2">{rankingAccessGuide.nextStep}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#dbe4ff] bg-white p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setProofCaptureMode('screenshot')}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${proofCaptureMode === 'screenshot' ? 'bg-[#0071e3] text-white' : 'bg-[#eef4ff] text-[#1d1d1f] hover:bg-[#dce9ff]'}`}
                      >
                        {isZh ? '上传 usage 截图' : 'Add screenshot proof'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProofCaptureMode('import')}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${proofCaptureMode === 'import' ? 'bg-[#111827] text-white' : 'bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                      >
                        {isZh ? '导入 usage 记录' : 'Import usage'}
                      </button>
                      {data.trustTier !== 'self-reported' && (
                        <button
                          type="button"
                          onClick={resetTrustState}
                          className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]"
                        >
                          {isZh ? '恢复为用户填写' : 'Reset to self-reported'}
                        </button>
                      )}
                    </div>

                    {proofCaptureMode === 'screenshot' ? (
                      <div className="mt-4 grid gap-4">
                        <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleProofFileUpload}
                            ref={proofFileInputRef}
                            className="hidden"
                          />
                          <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '添加截图凭证' : 'Add screenshot proof'}</div>
                          <p className="mt-2 text-xs leading-5 text-[#64748b]">{isZh ? '截图只用于升级可信等级，不会上传到服务器。' : 'Screenshots stay local and are only used to upgrade the trust state.'}</p>
                          <button
                            type="button"
                            onClick={() => proofFileInputRef.current?.click()}
                            className="mt-4 inline-flex items-center justify-center rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                          >
                            {isZh ? '选择截图' : 'Choose screenshots'}
                          </button>
                          {proofFiles.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {proofFiles.map((file) => (
                                <span key={`${file.name}-${file.size}`} className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-3 py-1 text-xs font-medium text-[#334155]">
                                  {file.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '数据来源' : 'Source'}</label>
                            <select
                              value={data.proofSource ?? ''}
                              onChange={(e) => updateField('proofSource', (e.target.value || undefined) as CardData['proofSource'])}
                              className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                            >
                              <option value="">{isZh ? '选择来源（可选）' : 'Choose source (optional)'}</option>
                              {Object.entries(PROOF_SOURCE_META).map(([value, meta]) => {
                                const m = meta as any;
                                return <option key={value} value={value}>{isZh ? m.labelZh : m.label}</option>;
                              })}
                            </select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '开始日期' : 'Start date'}</label>
                              <input
                                type="date"
                                value={data.proofDateRange?.start ?? ''}
                                onChange={(e) => updateProofDateRange('start', e.target.value)}
                                className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '结束日期' : 'End date'}</label>
                              <input
                                type="date"
                                value={data.proofDateRange?.end ?? ''}
                                onChange={(e) => updateProofDateRange('end', e.target.value)}
                                className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={applyScreenshotBackedTrust}
                            className="w-full rounded-xl bg-[#0ea5e9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0284c7]"
                          >
                            {isZh ? '升级为截图佐证' : 'Upgrade to screenshot-backed'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-4">
                        <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
                          <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '粘贴 usage 文本、账单摘要或导出内容' : 'Paste usage text, billing summary, or export data'}</div>
                          <p className="mt-2 text-xs leading-5 text-[#64748b]">{isZh ? 'TokCard 会识别 token 数字和来源，并把这张卡升级到可进榜的状态。' : 'TokCard will detect token volume and source, then upgrade the card to a ranking-ready state.'}</p>
                          <textarea
                            value={usageImportText}
                            onChange={(e) => setUsageImportText(e.target.value)}
                            placeholder={isZh ? '例如：Claude usage for Mar 1 - Mar 31: 2.3B input/output tokens...' : 'Example: Claude usage for Mar 1 - Mar 31: 2.3B input/output tokens...'}
                            className="mt-4 h-40 w-full rounded-2xl border border-[#d2d2d7] bg-white p-4 text-sm leading-6 text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] resize-none"
                          />
                        </div>
                        <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '数据来源' : 'Source'}</label>
                            <select
                              value={data.proofSource ?? ''}
                              onChange={(e) => updateField('proofSource', (e.target.value || undefined) as CardData['proofSource'])}
                              className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                            >
                              <option value="">{isZh ? '自动识别或手动选择' : 'Auto-detect or select manually'}</option>
                              {Object.entries(PROOF_SOURCE_META).map(([value, meta]) => {
                                const m = meta as any;
                                return <option key={value} value={value}>{isZh ? m.labelZh : m.label}</option>;
                              })}
                            </select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '开始日期' : 'Start date'}</label>
                              <input
                                type="date"
                                value={data.proofDateRange?.start ?? ''}
                                onChange={(e) => updateProofDateRange('start', e.target.value)}
                                className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '结束日期' : 'End date'}</label>
                              <input
                                type="date"
                                value={data.proofDateRange?.end ?? ''}
                                onChange={(e) => updateProofDateRange('end', e.target.value)}
                                className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleImportUsageRecord}
                            className="w-full rounded-xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f172a]"
                          >
                            {isZh ? '解析并升级到可进榜状态' : 'Parse and upgrade for ranking'}
                          </button>
                        </div>
                      </div>
                    )}

                    {proofFeedback && (
                      <div className="mt-4 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#334155]">
                        {proofFeedback}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(2)}
                className="px-6 py-3.5 rounded-xl border border-[#d2d2d7] text-[#1d1d1f] font-semibold hover:bg-[#f5f5f7]">
                {isZh ? '返回项目' : 'Back to project'}
              </button>
              <button type="button" onClick={() => setStep(4)}
                className="flex-1 px-6 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20 hover:opacity-95">
                {isZh ? '下一步：导出' : 'Next: export'}
              </button>
            </div>
            </div>
            </>)}

            {/* ===== STEP 4: 导出分享 ===== */}
            {step === 4 && (<>
            <div className="rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '名片四件套' : 'Card essentials'}</div>
                  <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{readinessScore}/{readinessItems.length} {isZh ? '项已完成' : 'items done'}</div>
                </div>
                <div className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#0071e3]">
                  {readinessScore === readinessItems.length ? (isZh ? '名片已成型' : 'Card is shaped') : (isZh ? '继续补齐' : 'Keep going')}
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-[#64748b]">
                {isZh ? '一张好 TokCard 会先展示 Token，再介绍项目，最后带出分享入口。' : 'A strong TokCard leads with tokens, explains the project, and finishes with a clear share path.'}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {readinessItems.map((item) => (
                  <div key={item.id} className={`rounded-2xl border px-3 py-3 text-sm ${item.done ? 'border-[#cce7d5] bg-[#f3fff7] text-[#166534]' : 'border-[#e2e8f0] bg-white text-[#64748b]'}`}>
                    <div className="font-medium">{item.done ? '✓' : '•'} {item.label}</div>
                    <div className="mt-1 text-xs opacity-80">{item.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '分享文案' : 'Share caption'}</div>
                  <div className="mt-1 text-xs text-[#94a3b8]">{isZh ? '放到最后一步，只看短版候选。' : 'Moved to the last step with shorter options only.'}</div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateCaptions}
                  disabled={isGeneratingCaptions || data.totalTokens <= 0}
                  className="rounded-full bg-[#111827] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isGeneratingCaptions ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '换一组' : 'Refresh')}
                </button>
              </div>
              {sortedAiCaptions.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {sortedAiCaptions.map((caption, index) => {
                    const trustMeta = getCaptionTrustMeta(caption.vibe, data.trustTier, data.locale);
                    const candidateText = [caption.title, caption.body, caption.hashtags.join(' ')].filter(Boolean).join('\n');
                    return (
                      <button
                        type="button"
                        key={`${caption.vibe}-${index}`}
                        onClick={() => setShareCaption(candidateText)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${activeShareCaption === candidateText ? 'border-[#0071e3] bg-[#f8fbff]' : 'border-[#dbe4ff] bg-white hover:border-[#0071e3]'}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#1d1d1f]">{caption.emoji} {caption.title}</span>
                          {index === 0 && <span className="inline-flex items-center rounded-full border border-[#c7ddff] bg-[#eef5ff] px-2 py-0.5 text-[10px] font-semibold text-[#0071e3]">{isZh ? '推荐' : 'Top'}</span>}
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${trustMeta.toneClass}`}>{trustMeta.badge}</span>
                        </div>
                        <div className="mt-2 text-sm text-[#475569]">{caption.body}</div>
                        {caption.hashtags.length > 0 && <div className="mt-2 text-xs text-[#0071e3]">{caption.hashtags.join(' ')}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {exportIssues.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-semibold">{isZh ? '导出前还差这些内容：' : 'Before exporting, finish these items:'}</div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-xs leading-5">
                  {exportIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}

            {exportProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#6b7280]">
                  <span>{isZh ? '导出进度' : 'Export progress'}</span>
                  <span>{exportProgress}%</span>
                </div>
                <div className="progress-bar bg-[#e5e7eb]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#0071e3_0%,#7c3aed_100%)] transition-[width] duration-300 ease-out" style={{ width: `${exportProgress}%` }} />
                </div>
              </div>
            )}

            {/* Export button */}
            <button type="button"
              onClick={handleExport}
              disabled={isExporting || !isPreviewReady || !canExport}
              className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] shadow-md flex items-center justify-center gap-2 bg-[#0071e3] text-white"
            >
              {isExporting ? (
                <>{isZh ? '生成中...' : 'Generating...'}</>
              ) : !canExport ? (
                <>{isZh ? '请先补齐必填项' : 'Complete required items first'}</>
              ) : !isPreviewReady ? (
                <>{isZh ? '图片同步中...' : 'Syncing images...'}</>
              ) : (
                <>{isZh ? '立即晒图' : 'Export for Social'}</>
              )}
            </button>
            {!isPreviewReady && (
              <p className="text-xs text-[#86868b] mt-3">
                {isZh ? '外部图片正在同步，完成后再导出会更稳定。' : 'External images are still syncing. Export works better after they finish loading.'}
              </p>
            )}
            <p className="text-xs text-[#86868b] mt-3">
              {isZh ? '导出后会给你一段可直接发朋友圈 / 小红书 / X 的文案。' : 'After export, you will get a caption ready for WeChat, Xiaohongshu, or X.'}
            </p>

            {/* Step 3 back navigation — desktop only, mobile uses sticky bar */}
            <div className="hidden lg:flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(3)}
                className="px-6 py-3.5 rounded-xl border border-[#d2d2d7] text-[#1d1d1f] font-semibold hover:bg-[#f5f5f7]">
                {isZh ? '返回风格' : 'Back to style'}
              </button>
            </div>
            </>)}
          </div>

          {/* Right: Card Preview */}
          <div className={`lg:sticky lg:top-24 lg:self-start relative min-w-0`} ref={previewContainerRef}>
            <div className="rounded-[24px] border border-[#dbe4ff] bg-white/92 p-5 shadow-sm backdrop-blur mb-6">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '这张名片会先让别人看到什么' : 'What people notice first'}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-2xl border border-[#eef2ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#1d1d1f]">{isZh ? 'Token 战绩' : 'Token proof'}</div>
                <div className="rounded-2xl border border-[#eef2ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#1d1d1f]">{isZh ? '主项目名片' : 'Project story'}</div>
                <div className="rounded-2xl border border-[#eef2ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#1d1d1f]">{isZh ? '排名与分享入口' : 'Rank & share path'}</div>
              </div>
            </div>
            <div className="mb-6 text-center">
              <div className="text-sm font-medium text-[#86868b]">{isZh ? '实时预览' : 'Live Preview'}</div>
              <div className="mt-2 text-xs leading-5 text-[#94a3b8]">{isZh ? '先看卡片有没有名片感，再决定是否补充高级选项。' : 'Judge the card as a social identity first, then decide whether it needs extra tuning.'}</div>
              <span className="mt-2 inline-flex rounded-full border border-[#dbe4ff] bg-white px-3 py-1 text-[11px] font-medium text-[#64748b]">{isZh ? platformInfo.labelZh : platformInfo.label} · {platformInfo.ratio}</span>
            </div>
            {!isPreviewReady && (
              <div className="mb-4 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#475569] text-center">
                {isZh ? '卡片里的图片还在同步，稍等一下导出会更稳定。' : 'Images inside the card are still syncing. Export will be more reliable in a moment.'}
              </div>
            )}
            {isMobile && step === 4 && (
              <div className="mb-4 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#475569] text-center">
                {isZh ? '这是实时预览，随时可以回到前面继续调整。' : 'This is the live preview. You can jump back to editing at any time.'}
              </div>
            )}
            <div className="relative flex justify-center overflow-hidden" ref={cardRef}>
              <div style={{ width: previewStageWidth * previewScale, height: previewStageHeight * previewScale }}>
                <div
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                    width: previewStageWidth,
                    height: previewStageHeight,
                    borderRadius: 28,
                    background: stageBackground,
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <CardRenderer data={previewCardData} renderId={previewRenderId} scale={previewCardScale} />
                </div>
              </div>
              {!isPreviewReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                  <div className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-xs font-semibold text-[#475569] shadow-sm">
                    {isZh ? '图片同步中…' : 'Syncing images…'}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile step 3 export button — hidden, using sticky bottom bar instead */}
          </div>
        </div>
      </div>

      {showShareSheet && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white shadow-2xl border border-black/5 p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                  {isZh ? '晒图文案已准备好' : 'Your social caption is ready'}
                </div>
                <p className="mt-2 text-sm text-[#6b7280]">
                  {isZh
                    ? `图片已经导出。复制文案去发帖时，会顺带表达这张卡当前的「${trustTierLabel}」状态；想把整条链路带出去时，再复制下方分享链接。`
                    : `Your card is exported. The caption now carries the card's current ${trustTierLabel} context, and you can copy the share link below when you want the full TokCard flow to travel with it.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareSheet(false)}
                className="rounded-full bg-[#f3f4f6] px-3 py-1.5 text-sm font-medium text-[#374151] hover:bg-[#e5e7eb]"
              >
                {isZh ? '关闭' : 'Close'}
              </button>
            </div>

            {recommendedAiCaption && recommendedCaptionMeta && (
              <div className="mt-5 rounded-2xl border border-[#dbe4ff] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#1d1d1f]">
                      {isZh ? '当前 trust 推荐文案' : 'Trust-aware recommended caption'}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-[#c7ddff] bg-[#eef5ff] px-2.5 py-1 text-[11px] font-semibold text-[#0071e3]">
                        {isZh ? '推荐优先发' : 'Top recommendation'}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${recommendedCaptionMeta.toneClass}`}>
                        {recommendedCaptionMeta.badge}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
                        {trustTierLabel}
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-[#1d1d1f]">
                      {recommendedAiCaption.emoji} {recommendedAiCaption.title}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#64748b]">
                      {recommendedCaptionMeta.helper}
                    </p>
                  </div>
                  {!isUsingRecommendedCaption && (
                    <button
                      type="button"
                      onClick={() => setShareCaption(recommendedCaptionText)}
                      className="shrink-0 rounded-xl border border-[#dbe4ff] bg-white px-4 py-2.5 text-sm font-medium text-[#1d1d1f] hover:bg-[#f8fbff]"
                    >
                      {isZh ? '切换为推荐文案' : 'Use recommended copy'}
                    </button>
                  )}
                </div>
                <div className="mt-3 text-xs text-[#94a3b8]">
                  {isUsingRecommendedCaption
                    ? (isZh ? '当前文本框里已经是推荐版本。' : 'The textarea below is already using the recommended version.')
                    : (isZh ? '你也可以保留自己手动挑选的版本。' : 'You can still keep your manually chosen version if you prefer.')}
                </div>
              </div>
            )}

            {shareCardId && (
              <div className="mt-5 rounded-2xl border border-[#dbe4ff] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#1d1d1f]">
                      {isZh ? '这张卡的排行反馈' : 'How this card ranks'}
                    </div>
                    {shareRankSummary ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full border border-[#c7ddff] bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#0071e3]">
                            {isZh ? `全球第 #${shareRankSummary.globalRank} 名` : `Global #${shareRankSummary.globalRank}`}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-3 py-1 text-xs font-medium text-[#334155]">
                            {isZh ? `超过 ${Math.max(0, 100 - shareRankSummary.percentile)}% 用户` : `Ahead of ${Math.max(0, 100 - shareRankSummary.percentile)}% of builders`}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-3 py-1 text-xs font-medium text-[#334155]">
                            {rankTier ? `${rankTier.badge} ${isZh ? rankTier.clubLabel : rankTier.clubLabelEn}` : rankingSignalLabel}
                          </span>
                        </div>
                        <div className="mt-3 text-xs leading-5 text-[#64748b]">
                          {isZh
                            ? `这张卡已经可以被排行榜聚焦查看。你现在也能顺手看看前面的人都在做什么项目。`
                            : `This card can now be opened with a focused leaderboard view, so you can compare your rank with what other builders are shipping.`}
                        </div>
                      </>
                    ) : canParticipateInRanking(data.trustTier) ? (
                      <div className="mt-3 text-xs leading-5 text-[#64748b]">
                        {isZh ? '排行榜数据正在同步，稍后用下面的链接进入聚焦视图即可。' : 'Leaderboard data is still syncing. Use the focused leaderboard link below in a moment.'}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs leading-5 text-[#64748b]">
                        {isZh ? '当前还是「用户填写」状态，所以会展示档位信号，但不会进入正式排名。补一张截图或导入 usage 记录后会更强。' : 'This card is still self-reported, so it shows a tier signal but does not enter the official ranking yet. Add proof or import usage to unlock stronger ranking views.'}
                      </div>
                    )}
                  </div>
                  <a
                    href={`/rank?focus=${shareCardId}`}
                    className="inline-flex items-center justify-center rounded-xl border border-[#dbe4ff] bg-white px-4 py-2.5 text-sm font-medium text-[#1d1d1f] hover:bg-[#f8fbff]"
                  >
                    {isZh ? '查看我的排行榜位置' : 'Open my leaderboard slot'}
                  </a>
                </div>
              </div>
            )}

            <textarea
              readOnly
              value={activeShareCaption}
              className="mt-5 h-44 w-full rounded-2xl border border-[#d1d5db] bg-[#f9fafb] p-4 text-sm leading-6 text-[#111827] focus:outline-none resize-none"
            />

            {shareLinkMeta && (
              <div className="mt-4 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[#1d1d1f]">
                    {isZh ? '分享链接' : 'Share link'}
                  </div>
                  {shareLinkMeta.isCompacted && (
                    <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
                      {isZh ? '已精简展示' : 'Compact preview'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-[#6b7280]">
                  {isZh
                    ? '发在评论区、私聊或简介里，别人点开后会先看到你的 TokCard，包括当前的可信标签、来源说明与项目入口。'
                    : 'Drop this in a comment, DM, or bio. People will land on your TokCard first, including its trust label, source context, and project links.'}
                </p>
                {shareLinkMeta.isCompacted && (
                  <p className="mt-2 text-[11px] leading-5 text-[#94a3b8]">
                    {isZh ? '当前窗口只展示精简版，复制时仍会带上完整链接。' : 'This modal shows a compact preview, but copy still uses the full link.'}
                  </p>
                )}
                <div className="mt-3 rounded-xl border border-[#dbe4ff] bg-white px-4 py-3 text-xs leading-5 text-[#334155] break-all">
                  {shareLinkMeta.display}
                </div>
                {shareLinkMeta.isCompacted && (
                  <details className="mt-3 text-xs text-[#64748b]">
                    <summary className="cursor-pointer text-[#0071e3] hover:underline">
                      {isZh ? '查看完整链接' : 'View full link'}
                    </summary>
                    <div className="mt-2 rounded-xl border border-[#dbe4ff] bg-white px-4 py-3 leading-5 break-all">
                      {shareLinkMeta.full}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:flex-wrap">
              <button
                type="button"
                onClick={() => setShowShareSheet(false)}
                className="px-5 py-3 rounded-xl border border-[#d1d5db] bg-white text-[#1d1d1f] font-medium hover:bg-[#f9fafb]"
              >
                {isZh ? '稍后再说' : 'Maybe later'}
              </button>
              {shareLink && (
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-5 py-3 rounded-xl border border-[#dbe4ff] bg-white text-[#1d1d1f] font-medium hover:bg-[#f8fbff]"
                >
                  {copyFeedback === 'link' ? (isZh ? '分享链接已复制' : 'Share link copied') : (isZh ? '复制分享链接' : 'Copy share link')}
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyShareCaption}
                className="px-5 py-3 rounded-xl bg-[#0071e3] text-white font-semibold hover:opacity-95"
              >
                {copyFeedback === 'caption' ? (isZh ? '文案已复制' : 'Caption copied') : (isZh ? '复制文案去晒图' : 'Copy caption and post')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: platformInfo.width,
          minHeight: platformInfo.height,
          pointerEvents: 'none',
        }}
      >
        <div
          id={exportRenderId}
          style={{
            width: platformInfo.width,
            minHeight: platformInfo.height,
            background: stageBackground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px 18px 24px',
            boxSizing: 'border-box',
          }}
        >
          <CardRenderer data={exportCardData} renderId={`${exportRenderId}-card`} scale={exportCardScale} onImageReady={setIsPreviewReady} />
        </div>
      </div>
    </div>
  );
}