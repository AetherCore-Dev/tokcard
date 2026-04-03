import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { parseAIOptions } from '@/lib/deepseek';
import type { CardData, FeaturedProject, ModelBreakdown, ProofSource } from '@/lib/card';
import {
  buildSharedCardUrl,
  canParticipateInRanking,
  createEmptyProject,
  decodeCardTemplatePreset,
  DEFAULT_CARD_DATA,
  FEATURED_PROJECT_LIMIT,
  formatProofDateRange,
  getProofSourceLabel,
  getRankingSignalDescription,
  getRankingSignalLabel,
  getTrustTierAccent,
  getTrustTierDescription,
  getTrustTierLabel,
  getMaxRankingDisplay,
  normalizeFeaturedProjects,
  parseTokenValue,
  PLATFORMS,
  PRESET_BACKGROUNDS,
  PROOF_SOURCE_META,
  sanitizeReferralCode,
} from '@/lib/card';
import { getAchievements, getGrowthPercentage } from '@/lib/achievements';
import { getMetaphor, METAPHOR_CATEGORY_LABELS, type MetaphorCategory } from '@/lib/metaphor';
import { CARD_PRESETS } from '@/lib/presets';
import { shareWithFallback } from '@/lib/share';
import { saveCardAndGetShortUrl } from '@/lib/card-storage';
import { getRankTier } from '@/lib/titles';
import CardRenderer from './CardRenderer';
import SuccessAnimation from './SuccessAnimation';
import { domToBlob } from 'modern-screenshot';

const SLOGAN_CATEGORY_LABELS = {
  flex: { zh: '炫耀', en: 'Flex' },
  selfMock: { zh: '自黑', en: 'Self Roast' },
  hype: { zh: '爆款', en: 'Viral' },
  geek: { zh: '极客', en: 'Geek' },
} as const;

const PRESET_SLOGANS_BY_CATEGORY = {
  flex: [
    '我跟 AI 说的话比跟人多',
    '一不小心又烧了 10 亿 token',
    '我写的不是代码，是算力排面',
    'AI 是同事，效率是副产品',
    'Prompt 写得好，像开外挂',
  ],
  selfMock: [
    '代码是 AI 写的，bug 是我的',
    '我不是在写代码，我是在养 AI',
    '需求没变，是我又问了一次 AI',
    '人类拍板，模型干活',
    '我会的不是技术，是使唤 AI',
  ],
  hype: [
    '这月 token，够我吹到下个月',
    'AI 工位战神申请出战',
    '今天的我，像开了十个分身',
    '发出来不是总结，是压迫感',
    '别人晒腹肌，我晒 token',
  ],
  geek: [
    'Build with AI, ship like a factory',
    'Vibe coding all day, every day',
    'AI is my copilot, and I drive fast',
    'Shipping faster than ever',
    'I talk to AI more than humans',
  ],
} as const;

const PRESET_EMOJIS = ['🤖', '👨‍💻', '👩‍💻', '🚀', '⚡', '🧠', '🔥', '💻', '🎮', '🦾', '🌟', '🕹️'];

const SLOGAN_MODE_LABELS = {
  personal: { zh: '个人名片', en: 'Personal' },
  project: { zh: '项目名片', en: 'Project' },
  social: { zh: '社交标题', en: 'Social' },
} as const;

interface AICaptionOption {
  title: string;
  body: string;
  hashtags: string[];
  emoji: string;
  vibe: 'flex' | 'hype' | 'technical';
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
  const matches = raw.match(/\d[\d,.]*(?:\.\d+)?\s*(?:billion|million|thousand|[kmb]|万|亿|tokens?)?/gi) ?? [];

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
      const hashtags = lines.find((line) => line.startsWith('HASHTAGS:'))?.replace('HASHTAGS:', '').trim().split(/\s+/).filter(Boolean) ?? [];
      const emoji = lines.find((line) => line.startsWith('EMOJI:'))?.replace('EMOJI:', '').trim() ?? '🔥';
      const vibe = (lines.find((line) => line.startsWith('VIBE:'))?.replace('VIBE:', '').trim() ?? 'hype') as AICaptionOption['vibe'];
      return { title, body, hashtags, emoji, vibe };
    })
    .filter((item) => item.title || item.body);
}

export default function CardEditor() {
  const [data, setData] = useState<CardData>({ ...DEFAULT_CARD_DATA, theme: 'brand-light' });
  const [tokenInput, setTokenInput] = useState('');
  const [step, setStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [aiSlogans, setAiSlogans] = useState<string[]>([]);
  const [aiMetaphors, setAiMetaphors] = useState<string[]>([]);
  const [aiCaptions, setAiCaptions] = useState<AICaptionOption[]>([]);
  const [isGeneratingSlogan, setIsGeneratingSlogan] = useState(false);
  const [isGeneratingMetaphor, setIsGeneratingMetaphor] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [sloganCategory, setSloganCategory] = useState<keyof typeof PRESET_SLOGANS_BY_CATEGORY>('hype');
  const [sloganMode, setSloganMode] = useState<keyof typeof SLOGAN_MODE_LABELS>('social');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<'caption' | 'link' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);
  const [proofCaptureMode, setProofCaptureMode] = useState<'screenshot' | 'import'>('screenshot');
  const [proofFiles, setProofFiles] = useState<{ name: string; size: number }[]>([]);
  const [usageImportText, setUsageImportText] = useState('');
  const [proofFeedback, setProofFeedback] = useState<string | null>(null);

  // Mobile detection and tab state
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

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
  }, []);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get('p');
    if (!preset) return;

    const decodedPreset = decodeCardTemplatePreset(preset);
    if (!decodedPreset) return;

    setData((prev) => ({ ...prev, ...decodedPreset }));
    setTokenInput('');
    setStep(3);
  }, []);

  // localStorage auto-save
  useEffect(() => {
    const saved = localStorage.getItem('tokcard:draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          setData(prev => ({ ...prev, ...parsed }));
          if (parsed.totalTokens) {
            setTokenInput(String(parsed.totalTokens));
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

  const isZh = data.locale === 'zh';
  const platformInfo = PLATFORMS[data.platform];
  const previewStageWidth = Math.round(platformInfo.width * 0.4);
  const previewStageHeight = Math.round(platformInfo.height * 0.4);
  const previewCardScale = Math.min(previewStageWidth / 540, previewStageHeight / 720);
  const exportCardScale = Math.min(platformInfo.width / 540, platformInfo.height / 720);
  const stageBackground = ['brand-dark', 'terminal-green', 'cyberpunk-neon', 'ocean-blue', 'sunset-warm'].includes(data.theme)
    ? '#05070b'
    : '#eef2ff';
  const activeMetaphor = useMemo(
    () => data.customMetaphor.trim() || getMetaphor(data.totalTokens || 10000, data.metaphorCategory, data.locale),
    [data.customMetaphor, data.totalTokens, data.metaphorCategory, data.locale]
  );
  const rankTier = useMemo(() => getRankTier(data.totalTokens), [data.totalTokens]);
  const achievements = useMemo(() => getAchievements(data), [data]);
  const growth = useMemo(() => getGrowthPercentage(data.totalTokens, data.lastMonthTokens), [data.totalTokens, data.lastMonthTokens]);
  const normalizedProjects = useMemo(() => normalizeFeaturedProjects(data.projects), [data.projects]);
  const readinessItems = useMemo(() => ([
    {
      id: 'identity',
      label: isZh ? '身份信息' : 'Identity',
      done: Boolean(data.username.trim() && data.slogan.trim()),
      hint: isZh ? '昵称 + 一句话签名' : 'Username + slogan',
    },
    {
      id: 'proof',
      label: isZh ? '战绩数据' : 'Proof',
      done: data.totalTokens > 0,
      hint: isZh ? '填写 token 体量' : 'Add token volume',
    },
    {
      id: 'credibility',
      label: isZh ? '可信度' : 'Trust',
      done: data.trustTier !== 'self-reported',
      hint: isZh ? '可选：截图或导入' : 'Optional: screenshot or import',
    },
    {
      id: 'projects',
      label: isZh ? '项目名片' : 'Projects',
      done: normalizedProjects.length > 0,
      hint: isZh ? '至少 1 个项目入口' : 'At least 1 project link',
    },
    {
      id: 'share',
      label: isZh ? '分享承接' : 'Share flow',
      done: Boolean(data.qrcodeUrl.trim()),
      hint: isZh ? '添加主页/GitHub 链接' : 'Add destination link',
    },
  ]), [data.qrcodeUrl, data.slogan, data.totalTokens, data.trustTier, data.username, isZh, normalizedProjects.length]);
  const readinessScore = useMemo(() => readinessItems.filter((item) => item.done).length, [readinessItems]);
  const trustTierLabel = useMemo(() => getTrustTierLabel(data.trustTier, data.locale), [data.locale, data.trustTier]);
  const trustTierDescription = useMemo(() => getTrustTierDescription(data.trustTier, data.locale), [data.locale, data.trustTier]);
  const trustTierAccent = useMemo(() => getTrustTierAccent(data.trustTier), [data.trustTier]);
  const proofSourceLabel = useMemo(() => (
    data.proofSource ? getProofSourceLabel(data.proofSource, data.locale) : ''
  ), [data.locale, data.proofSource]);
  const proofRangeLabel = useMemo(() => formatProofDateRange(data.proofDateRange, data.locale), [data.locale, data.proofDateRange]);
  const rankingDisplay = useMemo(() => getMaxRankingDisplay(data.trustTier), [data.trustTier]);
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
    setAiSlogans([]);
    setAiMetaphors([]);
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

  const ensureProjectSlots = useMemo(
    () => Array.from({ length: FEATURED_PROJECT_LIMIT }, (_, index) => data.projects[index] ?? createEmptyProject(index)),
    [data.projects]
  );

  const handleGenerateSlogan = useCallback(async () => {
    setIsGeneratingSlogan(true);
    setAiSlogans([]);
    try {
      const response = await fetch('/api/generate-slogan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username || 'developer',
          tokens: data.totalTokens,
          locale: data.locale,
          style: sloganCategory,
          titleMode: sloganMode,
        }),
      });

      if (!response.ok) {
        console.error('API error:', response.status);
        alert(isZh ? '生成失败，请重试' : 'Generation failed, please try again');
        setIsGeneratingSlogan(false);
        return;
      }

      const result = await response.json();
      setAiSlogans(parseAIOptions(result.content));
    } catch (err) {
      console.error('AI slogan generation failed:', err);
      alert(isZh ? '生成失败，请检查网络' : 'Generation failed, check network');
    } finally {
      setIsGeneratingSlogan(false);
    }
  }, [data.username, data.totalTokens, data.locale, isZh, sloganCategory, sloganMode]);

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
          username: data.username || 'developer',
          locale: data.locale,
          slogan: data.slogan,
          projects: normalizeFeaturedProjects(data.projects).map((project) => project.name),
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

      const result = await response.json();
      setAiCaptions(parseCaptionOptions(result.content));
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

  const handleGenerateMetaphor = useCallback(async () => {
    setIsGeneratingMetaphor(true);
    setAiMetaphors([]);
    try {
      const tokensToUse = data.totalTokens > 0 ? data.totalTokens : 10000;
      const response = await fetch('/api/generate-metaphor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: tokensToUse,
          locale: data.locale,
          category: data.metaphorCategory,
        }),
      });

      if (!response.ok) {
        console.error('API error:', response.status);
        alert(isZh ? '生成失败，请重试' : 'Generation failed, please try again');
        setIsGeneratingMetaphor(false);
        return;
      }

      const result = await response.json();
      const options = parseAIOptions(result.content);
      setAiMetaphors(options);
      updateField('customMetaphor', options[0] ?? '');
    } catch (err) {
      console.error('AI metaphor generation failed:', err);
      alert(isZh ? '生成失败，请检查网络' : 'Generation failed, check network');
    } finally {
      setIsGeneratingMetaphor(false);
    }
  }, [data.totalTokens, data.locale, isZh, updateField]);

  const handleTokenInput = useCallback((raw: string) => {
    setTokenInput(raw);
    updateField('totalTokens', parseTokenValue(raw));
  }, [updateField]);

  const handleModelBreakdown = useCallback((index: number, field: keyof ModelBreakdown, value: string | number) => {
    setData(prev => {
      const breakdown = [...prev.modelBreakdown];
      breakdown[index] = { ...breakdown[index], [field]: value };
      
      // Normalize percentages if they sum to more than 100
      const total = breakdown.reduce((sum, m) => sum + m.percentage, 0);
      if (total > 100) {
        const scale = 100 / total;
        breakdown.forEach(m => {
          m.percentage = Math.round(m.percentage * scale);
        });
        // Adjust last item to ensure sum is exactly 100
        const sum = breakdown.reduce((s, m) => s + m.percentage, 0);
        if (sum !== 100 && breakdown.length > 0) {
          breakdown[breakdown.length - 1].percentage += 100 - sum;
        }
      }
      
      return { ...prev, modelBreakdown: breakdown };
    });
  }, []);

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

  const handleMetaphorCategoryChange = useCallback((category: MetaphorCategory) => {
    setData(prev => ({
      ...prev,
      metaphorCategory: category,
      customMetaphor: '',
    }));
    setAiMetaphors([]);
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

  const handleBackgroundTypeChange = useCallback((type: CardData['backgroundType']) => {
    setData(prev => {
      if (type === 'none') {
        return { ...prev, backgroundType: 'none', backgroundValue: '' };
      }

      if (type === 'preset') {
        const nextValue = prev.backgroundType === 'preset' && prev.backgroundValue
          ? prev.backgroundValue
          : PRESET_BACKGROUNDS[0]?.value ?? '';
        return { ...prev, backgroundType: 'preset', backgroundValue: nextValue };
      }

      return {
        ...prev,
        backgroundType: 'custom',
        backgroundValue: prev.backgroundType === 'custom' ? prev.backgroundValue : '',
      };
    });
  }, []);

  const handleBackgroundUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        setData(prev => ({
          ...prev,
          backgroundType: 'custom',
          backgroundValue: event.target?.result as string,
        }));
      }
    };
    reader.onerror = () => {
      alert(isZh ? '文件读取失败，请重试' : 'Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  }, [validateImageFile, isZh]);

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
      ? (isZh ? `已选择 ${files.length} 张截图，可标记为”截图佐证”。` : `${files.length} screenshot(s) selected. You can now mark the card as proof attached.`)
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
    setProofFeedback(isZh ? '这张卡已升级为“截图佐证”，分享时会带上可信标签。' : 'This card is now marked as proof attached and will carry a trust label when shared.');
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
    setTokenInput(nextTotalTokens.toLocaleString());
    setProofFeedback(isZh
      ? `已按导入记录更新为 ${nextTotalTokens.toLocaleString()} token，并切换到“数据导入”状态。`
      : `Updated the card to ${nextTotalTokens.toLocaleString()} tokens and switched it to usage-imported status.`);
  }, [data.lastMonthTokens, data.totalTokens, isZh, usageImportText]);

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
    setProofFeedback(isZh ? '已恢复为默认的“用户填写”状态。' : 'Reverted the card to self-reported status.');
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

    const tokenText = data.totalTokens > 0 ? data.totalTokens.toLocaleString() : '0';
    const projectNames = normalizeFeaturedProjects(data.projects).map((project) => project.name).join(' · ');
    return isZh
      ? `${data.username || '我'}本月用 AI 烧了 ${tokenText} token。\n${trustCopyParts.trustLead}\n${activeMetaphor}。${projectNames ? `\n最近在做：${projectNames}。` : ''}\n${trustCopyParts.trustTail}\n这张卡是我准备发${platformInfo.labelZh}的，你也来生成一张：tokcard.dev\n#TokCard #AI战绩 #可信表达`
      : `${data.username || 'I'} burned ${tokenText} AI tokens this month.\n${trustCopyParts.trustLead}\n${activeMetaphor}.${projectNames ? `\nCurrently shipping: ${projectNames}.` : ''}\n${trustCopyParts.trustTail}\nBuilt this one for ${platformInfo.label}. Make yours at tokcard.dev\n#TokCard #AIFlex #BuilderProof`;
  }, [activeMetaphor, data.projects, data.totalTokens, data.username, isZh, platformInfo.label, platformInfo.labelZh, sortedAiCaptions, trustCopyParts]);
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

  const flashCopyFeedback = useCallback((type: 'caption' | 'link') => {
    setCopyFeedback(type);
    window.setTimeout(() => {
      setCopyFeedback((current) => (current === type ? null : current));
    }, 2000);
  }, []);

  const handleCopyShareCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareCaption || buildShareCaption());
      flashCopyFeedback('caption');
    } catch (err) {
      console.error('Copy failed:', err);
      alert(isZh ? '复制失败，请手动复制' : 'Copy failed, please copy manually');
    }
  }, [buildShareCaption, flashCopyFeedback, isZh, shareCaption]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      flashCopyFeedback('link');
    } catch (err) {
      console.error('Copy failed:', err);
      alert(isZh ? '复制失败，请手动复制' : 'Copy failed, please copy manually');
    }
  }, [flashCopyFeedback, isZh, shareLink]);

  const handleExport = useCallback(async () => {
    const el = document.getElementById(exportRenderId);
    if (!el) return;

    if (!isPreviewReady) {
      alert(isZh ? '图片仍在加载，请稍后再试。' : 'Images are still loading. Try again in a moment.');
      return;
    }

    setIsExporting(true);
    setExportProgress(8);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      setExportProgress(24);

      await waitForImagesToSettle(el);
      setExportProgress(42);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      setExportProgress(60);

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

      const filename = `tokcard-${data.username || 'card'}-${data.platform}.png`;
      const nextShareCaption = shareCaption || buildShareCaption();

      // Try short URL first, fall back to legacy base64 URL
      const cardWithRef = { ...data, referralCode: sanitizeReferralCode(data.referralCode || data.username) };
      const shortResult = await saveCardAndGetShortUrl(cardWithRef, window.location.origin);
      const nextShareLink = shortResult?.shortUrl
        ?? buildSharedCardUrl(cardWithRef, window.location.origin)
        ?? '';

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
      }

      setExportProgress(100);
      setShowSuccessAnimation(true);
      window.setTimeout(() => setShowSuccessAnimation(false), 2200);
      setShareCaption(nextShareCaption);
      setShareLink(nextShareLink);
      setCopyFeedback(null);
      setShowShareSheet(true);

    } catch (err) {
      console.error('Export failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(isZh 
        ? `下载失败 (${errMsg})\n\n可能原因：\n1. 浏览器拦截了下载\n2. 包含不受支持的外部图片\n\n请尝试：更换浏览器，或更换头像为 Emoji 后重试。` 
        : `Download failed: ${errMsg}. Try changing avatar or browser.`);
    } finally {
      setIsExporting(false);
      window.setTimeout(() => setExportProgress(0), 600);
    }
  }, [buildShareCaption, data, isZh, downloadViaLink, exportRenderId, isPreviewReady, shareCaption, waitForImagesToSettle]);

  const mobileBottomBar = (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-2 bg-gradient-to-t from-[#fbfbfd] via-[#fbfbfd] to-transparent">
      <div className="flex gap-2">
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)}
            className="px-5 py-3.5 rounded-xl border border-[#d2d2d7] text-[#1d1d1f] font-semibold">
            {isZh ? '上一步' : 'Back'}
          </button>
        )}
        {step < 3 ? (
          <button type="button" onClick={() => setStep(step + 1)}
            className="flex-1 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20">
            {step === 2 ? (isZh ? '预览并导出' : 'Preview & Export') : (isZh ? '下一步 →' : 'Next →')}
          </button>
        ) : (
          <button type="button" onClick={handleExport} disabled={isExporting}
            className="flex-1 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20 disabled:opacity-60">
            {isExporting ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '立即出图' : 'Export Now')}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-[#1d1d1f] bg-[#fbfbfd] selection:bg-[#0071e3] selection:text-white">
      <SuccessAnimation show={showSuccessAnimation} locale={isZh ? 'zh' : 'en'} />
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">
          {/* Left: Form */}
          <div className={`space-y-8 min-w-0 ${isMobile && step === 3 ? 'hidden' : ''}`}>
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-6">
              {[1, 2, 3].map((s) => (
                <button key={s} type="button" onClick={() => setStep(s)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    step === s ? 'bg-[#0071e3] text-white shadow-lg shadow-[#0071e3]/20'
                    : step > s ? 'bg-[#e8f5e9] text-[#2e7d32]'
                    : 'bg-[#f5f5f7] text-[#86868b]'
                  }`}>
                  <span>{step > s ? '✓' : s}</span>
                  <span className="hidden sm:inline">{
                    s === 1 ? (isZh ? '你是谁' : 'Identity')
                    : s === 2 ? (isZh ? '卡片风格' : 'Style')
                    : (isZh ? '导出分享' : 'Export')
                  }</span>
                </button>
              ))}
            </div>

            {/* ===== STEP 1: 你是谁 ===== */}
            {step === 1 && (<>
            <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b]">{isZh ? '快速开始' : 'Quick start'}</div>
                  <div className="mt-1 text-sm text-[#6b7280]">{isZh ? '一键套用热门人设与视觉模板。' : 'Apply a viral persona and visual preset in one tap.'}</div>
                </div>
                <div className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#0071e3]">{isZh ? '自动成片' : 'Auto styled'}</div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CARD_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4 text-left transition hover:border-[#0071e3] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#1d1d1f]">{preset.emoji} {preset.name}</div>
                        <div className="mt-1 text-xs leading-5 text-[#6b7280]">{preset.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '用户名' : 'Username'}
              </label>
              <input
                type="text"
                value={data.username}
                onChange={e => updateField('username', e.target.value)}
                placeholder={isZh ? '你的名字或昵称' : 'Your name or handle'}
                className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
              />
            </div>

            {/* Token amount */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '月 Token 消耗量' : 'Monthly Token Usage'}
              </label>
              <input
                type="text"
                value={tokenInput}
                onChange={e => handleTokenInput(e.target.value)}
                placeholder={isZh ? '例如: 2.3B, 500M, 10万' : 'e.g. 2.3B, 500M, 1000000'}
                className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
              />
              <p className="mt-2 text-xs text-[#86868b]">
                {isZh ? '支持 K/M/B/万 缩写，如 2.3B = 23 亿' : 'Supports K/M/B suffixes, e.g. 2.3B = 2,300,000,000'}
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
              <details className="mt-3 text-xs text-[#6b7280]">
                <summary className="cursor-pointer text-[#0071e3] hover:underline">
                  {isZh ? '去哪里查 token 用量？' : 'Where to find your token usage?'}
                </summary>
                <div className="mt-2 space-y-1 pl-2 border-l-2 border-[#dbe4ff]">
                  <div><strong>Claude:</strong> {isZh ? 'Settings → Usage' : 'Settings → Usage'}</div>
                  <div><strong>GPT:</strong> {isZh ? 'Usage dashboard（platform.openai.com/usage）' : 'Usage dashboard (platform.openai.com/usage)'}</div>
                  <div><strong>Cursor:</strong> {isZh ? 'Account → Usage' : 'Account → Usage'}</div>
                </div>
              </details>
            </div>

            {/* Channel selector (main model) */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '主力模型' : 'Main Model'}
              </label>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {(['claude', 'gpt', 'cursor', 'deepseek', 'gemini', 'other'] as const).map((ch) => {
                  const chInfo = { claude: 'Claude', gpt: 'GPT', cursor: 'Cursor', deepseek: 'DeepSeek', gemini: 'Gemini', other: isZh ? '其他/混合' : 'Other/Mixed' }[ch];
                  return (
                    <button type="button" key={ch}
                      onClick={() => updateField('channel', ch)}
                      className={`p-3 rounded-xl border text-left transition-all ${data.channel === ch ? 'border-[#0071e3] bg-[#0071e3]/5 ring-4 ring-[#0071e3]/10' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'}`}
                    >
                      <div className="text-sm font-semibold text-[#1d1d1f]">{chInfo}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 1 navigation */}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(step + 1)}
                className="flex-1 px-6 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20 hover:opacity-95">
                {isZh ? '下一步' : 'Next'}
              </button>
            </div>
            </>)}

            {/* ===== STEP 2: 卡片风格 ===== */}
            {step === 2 && (<>
            {/* Theme */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '卡片主题' : 'Card Theme'}
              </label>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {([
                  { value: 'brand-light', label: isZh ? '晨曦白' : 'Dawn White', preview: 'bg-[#fbfbfd] border-[#d2d2d7]' },
                  { value: 'brand-dark', label: isZh ? '午夜紫' : 'Midnight Violet', preview: 'bg-[#0f0f12] border-purple-500' },
                  { value: 'bold-violet', label: isZh ? '高亮紫' : 'Bold Violet', preview: 'bg-purple-700 border-amber-500' },
                  { value: 'mono-brutal', label: isZh ? '粗野黑白' : 'Mono Brutal', preview: 'bg-white border-black border-2' },
                  { value: 'terminal-green', label: isZh ? '黑客帝国' : 'Terminal Green', preview: 'bg-[#07130c] border-green-500' },
                  { value: 'cyberpunk-neon', label: isZh ? '赛博霓虹' : 'Cyberpunk Neon', preview: 'bg-fuchsia-700 border-cyan-300' },
                  { value: 'gradient-dream', label: isZh ? '梦幻渐变' : 'Gradient Dream', preview: 'bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 border-white/30' },
                  { value: 'sunset-warm', label: isZh ? '暖阳橙' : 'Sunset Warm', preview: 'bg-orange-700 border-amber-300' },
                  { value: 'ocean-blue', label: isZh ? '深海蓝' : 'Ocean Blue', preview: 'bg-sky-950 border-sky-400' },
                  { value: 'minimal-gray', label: isZh ? '极简灰' : 'Minimal Gray', preview: 'bg-gray-100 border-gray-300' },
                ] as const).map(theme => (
                  <button type="button"
                    key={theme.value}
                    onClick={() => updateField('theme', theme.value)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${data.theme === theme.value ? 'border-[#0071e3] bg-[#0071e3]/5 ring-4 ring-[#0071e3]/10' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'}`}
                  >
                    <div className={`w-full h-8 rounded-lg mb-2 ${theme.preview} border`} />
                    <span className="text-sm font-medium text-[#1d1d1f]">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '晒图平台' : 'Share Target'}
              </label>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {(Object.entries(PLATFORMS) as [keyof typeof PLATFORMS, typeof PLATFORMS[keyof typeof PLATFORMS]][]).map(([key, item]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => updateField('platform', key)}
                    className={`p-3 rounded-xl border text-left transition-all ${data.platform === key ? 'border-[#0071e3] bg-[#0071e3]/5 ring-4 ring-[#0071e3]/10' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'}`}
                  >
                    <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? item.labelZh : item.label}</div>
                    <div className="mt-1 text-xs text-[#86868b]">{item.ratio} · {item.width}×{item.height}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#86868b]">
                {isZh ? '切到目标平台后，预览和导出会按对应比例居中排版。' : 'Preview and export will fit the selected platform ratio.'}
              </p>
            </div>

            {/* Slogan - Step 2 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[13px] font-semibold text-[#86868b] uppercase tracking-wide">
                  {isZh ? '个人签名' : 'Slogan'}
                </label>
                <button type="button"
                  onClick={handleGenerateSlogan}
                  disabled={isGeneratingSlogan}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-opacity disabled:opacity-50 flex items-center gap-1 bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20"
                >
                  {isGeneratingSlogan ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '✨ AI 帮我写' : '✨ AI Generate')}
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(Object.entries(SLOGAN_MODE_LABELS) as [keyof typeof SLOGAN_MODE_LABELS, { zh: string; en: string }][]).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSloganMode(key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${sloganMode === key ? 'bg-[#0071e3] text-white' : 'bg-[#eef4ff] text-[#1d1d1f] hover:bg-[#dce9ff]'}`}
                  >
                    {isZh ? label.zh : label.en}
                  </button>
                ))}
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(Object.entries(SLOGAN_CATEGORY_LABELS) as [keyof typeof PRESET_SLOGANS_BY_CATEGORY, { zh: string; en: string }][]).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSloganCategory(key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${sloganCategory === key ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                  >
                    {isZh ? label.zh : label.en}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={data.slogan}
                onChange={e => updateField('slogan', e.target.value)}
                placeholder={isZh ? '一句话介绍自己' : 'One line about you'}
                className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
                maxLength={60}
              />
              {aiSlogans.length > 0 && (
                <div className="mt-3 p-4 rounded-xl bg-white border border-[#0071e3]/30 shadow-sm">
                  <div className="text-xs font-medium mb-3 text-[#0071e3]">{isZh ? 'AI 推荐 (点击选择)' : 'AI Suggestions (click to use)'}</div>
                  <div className="flex flex-col gap-2">
                    {aiSlogans.map((s, i) => (
                      <button type="button"
                        key={i}
                        onClick={() => updateField('slogan', s)}
                        className={`text-left text-sm px-4 py-2.5 rounded-lg transition-all border ${data.slogan === s ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm' : 'bg-[#f5f5f7] text-[#1d1d1f] border-transparent hover:bg-[#0071e3] hover:text-white'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESET_SLOGANS_BY_CATEGORY[sloganCategory].map(s => (
                  <button type="button"
                    key={s}
                    onClick={() => updateField('slogan', s)}
                    className={`text-xs px-3 py-1.5 border rounded-full transition-colors ${data.slogan === s ? 'bg-[#0071e3] border-[#0071e3] text-white' : 'bg-white border-[#d2d2d7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 navigation */}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(step - 1)}
                className="px-6 py-3.5 rounded-xl border border-[#d2d2d7] text-[#1d1d1f] font-semibold hover:bg-[#f5f5f7]">
                {isZh ? '上一步' : 'Back'}
              </button>
              <button type="button" onClick={() => setStep(step + 1)}
                className="flex-1 px-6 py-3.5 rounded-xl bg-[#0071e3] text-white font-semibold shadow-lg shadow-[#0071e3]/20 hover:opacity-95">
                {isZh ? '预览并导出' : 'Preview & Export'}
              </button>
            </div>
            </>)}

            {/* ===== 「更多选项」Advanced accordion (visible on step 1 and 2) ===== */}
            {(step === 1 || step === 2) && (
            <div className="rounded-[24px] border border-[#dbe4ff] bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#f8fbff] transition-colors"
              >
                <div>
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b]">
                    {isZh ? '更多选项' : 'More Options'}
                  </span>
                  <span className="ml-2 text-xs text-[#94a3b8]">
                    {isZh ? '头像、背景、比喻、项目名片等' : 'Avatar, background, metaphor, projects, etc.'}
                  </span>
                </div>
                <span className={`text-[#86868b] transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {showAdvanced && (
              <div className="px-5 pb-5 space-y-8">

            {/* Last month tokens */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                  {isZh ? '上月 Token' : 'Last month tokens'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={data.lastMonthTokens || ''}
                  onChange={e => updateField('lastMonthTokens', Math.max(0, Number(e.target.value) || 0))}
                  placeholder={isZh ? '用于生成增速徽章' : 'Used for growth badge'}
                  className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
                />
              </div>
              <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">{isZh ? '自动档位' : 'Auto rank'}</div>
                <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{rankTier.badge} {isZh ? rankTier.clubLabel : rankTier.clubLabelEn}</div>
                <div className="mt-1 text-sm text-[#64748b]">{rankingSignalLabel}{growth > 0 ? ` · +${growth}%` : ''}</div>
                <div className="mt-1 text-xs leading-5 text-[#94a3b8]">{rankingSignalDescription}</div>
              </div>
            </div>
            {achievements.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {achievements.map((achievement) => (
                  <span key={achievement.id} className="inline-flex items-center gap-1 rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
                    <span>{achievement.icon}</span>
                    <span>{isZh ? achievement.label : achievement.labelEn}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Background */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '背景图' : 'Background'}
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {([
                  { value: 'none', label: isZh ? '纯色' : 'Solid' },
                  { value: 'preset', label: isZh ? '预设' : 'Preset' },
                  { value: 'custom', label: isZh ? '上传图片' : 'Upload' },
                ] as const).map(option => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => handleBackgroundTypeChange(option.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${data.backgroundType === option.value ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {data.backgroundType === 'preset' && (
                <div className="grid grid-cols-3 gap-3">
                  {PRESET_BACKGROUNDS.map(background => (
                    <button
                      type="button"
                      key={background.value}
                      onClick={() => {
                        setData(prev => ({ ...prev, backgroundType: 'preset', backgroundValue: background.value }));
                      }}
                      className={`overflow-hidden rounded-xl border-2 transition-all text-left ${data.backgroundValue === background.value ? 'border-[#0071e3] ring-4 ring-[#0071e3]/10' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'}`}
                    >
                      <img src={background.value} alt={isZh ? background.labelZh : background.label} className="h-24 w-full object-cover" />
                      <div className="px-3 py-2 text-xs font-medium text-[#1d1d1f] bg-white">
                        {isZh ? background.labelZh : background.label}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {data.backgroundType === 'custom' && (
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    ref={backgroundFileInputRef}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => backgroundFileInputRef.current?.click()}
                    className="px-6 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] font-medium hover:bg-[#f5f5f7] transition-colors"
                  >
                    {isZh ? '选择背景图...' : 'Choose Background...'}
                  </button>
                  {data.backgroundValue && (
                    <img src={data.backgroundValue} alt="Background preview" className="w-20 h-12 rounded-lg object-cover border border-[#d2d2d7]" />
                  )}
                </div>
              )}

              <p className="mt-2 text-xs text-[#86868b]">
                {isZh ? '建议使用对比强、层次明显的图片，导出更出片。' : 'High-contrast backgrounds usually export best.'}
              </p>
            </div>

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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[13px] font-semibold text-[#86868b] uppercase tracking-wide">
                  {isZh ? '爆款分享文案' : 'Viral caption'}
                </label>
                <button
                  type="button"
                  onClick={handleGenerateCaptions}
                  disabled={isGeneratingCaptions}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-opacity disabled:opacity-50 flex items-center gap-1 bg-[#111827]/10 text-[#111827] hover:bg-[#111827]/15"
                >
                  {isGeneratingCaptions ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '🔥 生成 3 版文案' : '🔥 Generate 3 captions')}
                </button>
              </div>
              <p className="text-xs text-[#86868b] mb-3">
                {isZh ? '会结合你的 token、比喻、项目名片和 trust 状态，生成适合目标平台的发帖版本。' : 'Generates platform-ready posting copy from your tokens, metaphor, featured projects, and current trust state.'}
              </p>
              {sortedAiCaptions.length > 0 && (
                <div>
                  <div className="mb-3 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-xs leading-5 text-[#64748b]">
                    {isZh
                      ? `已按当前「${trustTierLabel}」状态自动排序，第一张最适合直接发。`
                      : `Auto-sorted for the current ${trustTierLabel} state. The first card is the best fit to post now.`}
                  </div>
                  <div className="grid gap-3">
                    {sortedAiCaptions.map((caption, index) => {
                      const trustMeta = getCaptionTrustMeta(caption.vibe, data.trustTier, data.locale);
                      return (
                        <button
                          type="button"
                          key={`${caption.vibe}-${index}`}
                          onClick={() => setShareCaption([caption.title, caption.body, caption.hashtags.join(' ')].filter(Boolean).join('\n'))}
                          className={`rounded-2xl border p-4 text-left transition ${shareCaption.includes(caption.title) ? 'border-[#0071e3] bg-[#f8fbff]' : 'border-[#dbe4ff] bg-white hover:border-[#0071e3]'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[#1d1d1f]">{caption.emoji} {caption.title}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{caption.vibe}</div>
                                {index === 0 && (
                                  <span className="inline-flex items-center rounded-full border border-[#c7ddff] bg-[#eef5ff] px-2.5 py-1 text-[11px] font-semibold text-[#0071e3]">
                                    {isZh ? '推荐优先发' : 'Top recommendation'}
                                  </span>
                                )}
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${trustMeta.toneClass}`}>
                                  {trustMeta.badge}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
                                  {trustTierLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs leading-5 text-[#64748b]">{trustMeta.helper}</div>
                          <div className="mt-3 text-sm leading-6 text-[#475569]">{caption.body}</div>
                          <div className="mt-3 text-xs text-[#0071e3]">{caption.hashtags.join(' ')}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '模型分布' : 'Model mix'}
              </label>
              <div className="space-y-3">
                {data.modelBreakdown.map((model, index) => (
                  <div key={`${model.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_100px] gap-3">
                    <input
                      type="text"
                      value={model.name}
                      onChange={e => handleModelBreakdown(index, 'name', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={model.percentage}
                      onChange={e => handleModelBreakdown(index, 'percentage', Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-4 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Metaphor category */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[13px] font-semibold text-[#86868b] uppercase tracking-wide">
                  {isZh ? '比喻风格' : 'Metaphor Style'}
                </label>
                <button type="button"
                  onClick={handleGenerateMetaphor}
                  disabled={isGeneratingMetaphor}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-opacity disabled:opacity-50 flex items-center gap-1 bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20"
                >
                  {isGeneratingMetaphor ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '✨ AI 生成比喻' : '✨ AI Metaphors')}
                </button>
              </div>
              {aiMetaphors.length > 0 && (
                <>
                  <div className="mb-4 p-4 rounded-xl bg-white border border-[#0071e3]/30 shadow-sm">
                    <div className="text-xs font-medium mb-3 text-[#0071e3]">{isZh ? 'AI 生成的比喻 (点击应用)' : 'AI Generated Metaphors (tap to apply)'}</div>
                    <div className="flex flex-col gap-2">
                      {aiMetaphors.map((m, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => updateField('customMetaphor', m)}
                          className={`text-left text-sm px-4 py-2.5 rounded-lg transition-all border ${data.customMetaphor === m ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm' : 'bg-[#f5f5f7] text-[#1d1d1f] border-transparent hover:bg-[#0071e3] hover:text-white'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[#86868b]">
                    {data.customMetaphor ? (isZh ? '已应用到卡片预览，点击其他项可切换。' : 'Applied to the card preview. Tap another option to switch.') : (isZh ? '点击任意比喻即可应用到卡片。' : 'Tap any metaphor to apply it to the card.')}
                  </p>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {(Object.entries(METAPHOR_CATEGORY_LABELS) as [MetaphorCategory, { zh: string; en: string }][]).map(([key, label]) => (
                  <button type="button"
                    key={key}
                    onClick={() => handleMetaphorCategoryChange(key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${data.metaphorCategory === key ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                  >
                    {isZh ? label.zh : label.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '精选项目名片' : 'Featured projects'}
              </label>
              <div className="space-y-3">
                {ensureProjectSlots.map((project, index) => (
                  <div key={project.id} className="grid gap-3 md:grid-cols-[84px_minmax(0,1fr)_minmax(0,1.4fr)]">
                    <input
                      type="text"
                      value={project.icon}
                      onChange={e => updateProject(index, 'icon', e.target.value)}
                      placeholder={isZh ? '图标/Emoji' : 'Icon'}
                      className="w-full px-4 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                    />
                    <input
                      type="text"
                      value={project.name}
                      onChange={e => updateProject(index, 'name', e.target.value)}
                      placeholder={isZh ? '项目名 / GitHub / 网站' : 'Project name'}
                      className="w-full px-4 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                    />
                    <input
                      type="url"
                      value={project.url}
                      onChange={e => updateProject(index, 'url', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#86868b]">
                {isZh ? '最多 3 个项目，会显示在卡片底部，强化“名片感”。' : 'Up to 3 projects shown in the footer as your business-card proof.'}
              </p>
            </div>

            {/* QR code */}
            <div>
              <label className="block text-[13px] font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                {isZh ? '二维码链接' : 'QR Code Link'}
              </label>
              <input
                type="url"
                value={data.qrcodeUrl}
                onChange={e => updateField('qrcodeUrl', e.target.value)}
                placeholder={isZh ? '例如：https://github.com/yourname' : 'e.g. https://github.com/yourname'}
                className="w-full px-4 py-3.5 bg-white border border-[#d2d2d7] rounded-xl text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all shadow-sm"
              />
              <p className="mt-2 text-xs text-[#86868b]">
                {isZh ? '可放 GitHub、个人主页或项目链接。扫码会先展示你的 TokCard，再一键前往这个链接。留空则不显示二维码。' : 'Add GitHub, portfolio, or project link. Scanning opens your TokCard first, then sends visitors to this link in one tap. Leave empty to hide the QR code.'}
              </p>
            </div>

            <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '可信等级' : 'Trust layer'}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        color: trustTierAccent,
                        borderColor: `${trustTierAccent}33`,
                        backgroundColor: `${trustTierAccent}12`,
                      }}
                    >
                      {trustTierLabel}
                    </span>
                    {data.proofSource && (
                      <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1 text-xs font-medium text-[#334155]">
                        {proofSourceLabel}
                      </span>
                    )}
                    {proofRangeLabel && (
                      <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-3 py-1 text-xs font-medium text-[#64748b]">
                        {proofRangeLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b7280]">
                    {trustTierDescription}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 lg:min-w-[220px]">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '排名资格' : 'Ranking access'}</div>
                  <div className="mt-2 text-sm font-semibold text-[#1d1d1f]">
                    {rankingDisplay === 'hidden'
                      ? (isZh ? '仅展示档位信号，不进正式排名' : 'Tier signal only, no official ranking yet')
                      : rankingDisplay === 'range'
                        ? (isZh ? '可进入区间比较 / 百分位展示' : 'Eligible for range comparison / percentile views')
                        : (isZh ? '可进入更强的排名展示' : 'Eligible for stronger ranking views')}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#64748b]">
                    {rankingSignalDescription}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setProofCaptureMode('screenshot')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${proofCaptureMode === 'screenshot' ? 'bg-[#0071e3] text-white' : 'bg-[#eef4ff] text-[#1d1d1f] hover:bg-[#dce9ff]'}`}
                >
                  {isZh ? '截图佐证' : 'Screenshot proof'}
                </button>
                <button
                  type="button"
                  onClick={() => setProofCaptureMode('import')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${proofCaptureMode === 'import' ? 'bg-[#111827] text-white' : 'bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                >
                  {isZh ? '导入消费记录' : 'Import usage'}
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
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleProofFileUpload}
                      ref={proofFileInputRef}
                      className="hidden"
                    />
                    <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '上传 usage / 账单截图' : 'Upload usage or billing screenshots'}</div>
                    <p className="mt-2 text-xs leading-5 text-[#64748b]">
                      {isZh ? '用于把卡片升级为“截图佐证”。当前版本不会把截图本身放进分享链接，只会带上可信标签、来源和日期范围。' : 'Use this to upgrade the card to proof attached. The screenshot itself stays local in this version; only the trust label, source, and date range travel with the shared card.'}
                    </p>
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
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                        {isZh ? '数据来源' : 'Source'}
                      </label>
                      <select
                        value={data.proofSource ?? ''}
                        onChange={(e) => updateField('proofSource', (e.target.value || undefined) as CardData['proofSource'])}
                        className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                      >
                        <option value="">{isZh ? '选择来源（可选）' : 'Choose source (optional)'}</option>
                        {(Object.entries(PROOF_SOURCE_META) as [ProofSource, { label: string; labelZh: string }][]).map(([value, meta]) => (
                          <option key={value} value={value}>{isZh ? meta.labelZh : meta.label}</option>
                        ))}
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
                      {isZh ? '标记为截图佐证' : 'Mark as proof attached'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
                    <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '粘贴 usage 文本、账单摘要或导出内容' : 'Paste usage text, billing summary, or export data'}</div>
                    <p className="mt-2 text-xs leading-5 text-[#64748b]">
                      {isZh ? '可以是 dashboard 文本、账单摘要、CSV/JSON 摘要片段。TokCard 会尽量识别来源和 token 数字，并允许你继续手动修正。' : 'Paste dashboard text, billing snippets, or CSV/JSON summaries. TokCard will try to detect the source and token volume, then you can still refine the numbers manually.'}
                    </p>
                    <textarea
                      value={usageImportText}
                      onChange={(e) => setUsageImportText(e.target.value)}
                      placeholder={isZh ? '例如：Claude usage for Mar 1 - Mar 31: 2.3B input/output tokens...' : 'Example: Claude usage for Mar 1 - Mar 31: 2.3B input/output tokens...'}
                      className="mt-4 h-40 w-full rounded-2xl border border-[#d2d2d7] bg-white p-4 text-sm leading-6 text-[#1d1d1f] placeholder-[#94a3b8] focus:outline-none focus:border-[#0071e3] resize-none"
                    />
                  </div>
                  <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                        {isZh ? '数据来源' : 'Source'}
                      </label>
                      <select
                        value={data.proofSource ?? ''}
                        onChange={(e) => updateField('proofSource', (e.target.value || undefined) as CardData['proofSource'])}
                        className="mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                      >
                        <option value="">{isZh ? '自动识别或手动选择' : 'Auto-detect or select manually'}</option>
                        {(Object.entries(PROOF_SOURCE_META) as [ProofSource, { label: string; labelZh: string }][]).map(([value, meta]) => (
                          <option key={value} value={value}>{isZh ? meta.labelZh : meta.label}</option>
                        ))}
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
                      {isZh ? '解析并应用到卡片' : 'Parse and apply to card'}
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
            )}
            </div>
            )}

            {/* ===== STEP 3: 导出分享 ===== */}
            {step === 3 && (<>
            <div className="rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '成片就绪度' : 'Ready to export'}</div>
                  <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{readinessScore}/{readinessItems.length} {isZh ? '项已完成' : 'items done'}</div>
                </div>
                <div className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#0071e3]">
                  {readinessScore === readinessItems.length ? (isZh ? '可直接晒图' : 'Ready to post') : (isZh ? '继续补齐' : 'Keep going')}
                </div>
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
              disabled={isExporting || !isPreviewReady}
              className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] shadow-md flex items-center justify-center gap-2 bg-[#0071e3] text-white"
            >
              {isExporting ? (
                <>{isZh ? '生成中...' : 'Generating...'}</>
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

            {/* Step 3 back navigation */}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(step - 1)}
                className="px-6 py-3.5 rounded-xl border border-[#d2d2d7] text-[#1d1d1f] font-semibold hover:bg-[#f5f5f7]">
                {isZh ? '上一步' : 'Back'}
              </button>
            </div>
            </>)}
          </div>

          {/* Right: Card Preview */}
          <div className={`lg:sticky lg:top-24 lg:self-start relative min-w-0 ${isMobile && step !== 3 ? 'hidden' : ''}`} ref={previewContainerRef}>
            <div className="rounded-[24px] border border-[#dbe4ff] bg-white/92 p-5 shadow-sm backdrop-blur mb-6">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '你将带走什么' : 'What you will export'}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-2xl border border-[#eef2ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#1d1d1f]">{isZh ? '高清 PNG 卡片' : 'High-res PNG'}</div>
                <div className="rounded-2xl border border-[#eef2ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#1d1d1f]">{isZh ? '可直接发帖的文案' : 'Post-ready caption'}</div>
                <div className="rounded-2xl border border-[#eef2ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#1d1d1f]">{isZh ? '可继续传播的分享链接' : 'Shareable landing link'}</div>
              </div>
            </div>
            <div className="text-sm font-medium text-[#86868b] mb-6 text-center">
              {isZh ? '实时预览' : 'Live Preview'}
              <span className="ml-2 text-xs opacity-70">{isZh ? platformInfo.labelZh : platformInfo.label} · {platformInfo.ratio}</span>
            </div>
            <div className="flex justify-center overflow-hidden" ref={cardRef}>
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
                  <CardRenderer data={data} renderId={previewRenderId} scale={previewCardScale} />
                </div>
              </div>
            </div>

            {isMobile && step === 3 && (
              <div className="mt-8 px-4">
                <button type="button"
                  onClick={handleExport}
                  disabled={isExporting || !isPreviewReady}
                  className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] shadow-md flex items-center justify-center gap-2 bg-[#0071e3] text-white"
                >
                  {isExporting ? (isZh ? '生成中...' : 'Generating...') : !isPreviewReady ? (isZh ? '图片同步中...' : 'Syncing images...') : (isZh ? '立即晒图' : 'Export for Social')}
                </button>
              </div>
            )}
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

            <textarea
              readOnly
              value={activeShareCaption}
              className="mt-5 h-44 w-full rounded-2xl border border-[#d1d5db] bg-[#f9fafb] p-4 text-sm leading-6 text-[#111827] focus:outline-none resize-none"
            />

            {shareLink && (
              <div className="mt-4 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
                <div className="text-sm font-semibold text-[#1d1d1f]">
                  {isZh ? '分享链接' : 'Share link'}
                </div>
                <p className="mt-1 text-xs leading-5 text-[#6b7280]">
                  {isZh
                    ? '发在评论区、私聊或简介里，别人点开后会先看到你的 TokCard，包括当前的可信标签、来源说明与项目入口。'
                    : 'Drop this in a comment, DM, or bio. People will land on your TokCard first, including its trust label, source context, and project links.'}
                </p>
                <div className="mt-3 rounded-xl border border-[#dbe4ff] bg-white px-4 py-3 text-xs leading-5 text-[#334155] break-all">
                  {shareLink}
                </div>
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
          }}
        >
          <CardRenderer data={data} renderId={`${exportRenderId}-card`} scale={exportCardScale} onImageReady={setIsPreviewReady} />
        </div>
      </div>
    </div>
  );
}