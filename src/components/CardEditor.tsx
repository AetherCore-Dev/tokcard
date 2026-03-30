import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { parseAIOptions } from '@/lib/deepseek';
import type { CardData, ModelBreakdown } from '@/lib/card';
import { DEFAULT_CARD_DATA, PLATFORMS, PRESET_BACKGROUNDS } from '@/lib/card';
import { getMetaphor, METAPHOR_CATEGORY_LABELS, type MetaphorCategory } from '@/lib/metaphor';
import CardRenderer from './CardRenderer';
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

export default function CardEditor() {
  const [data, setData] = useState<CardData>({ ...DEFAULT_CARD_DATA, theme: 'brand-light' });
  const [tokenInput, setTokenInput] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [aiSlogans, setAiSlogans] = useState<string[]>([]);
  const [aiMetaphors, setAiMetaphors] = useState<string[]>([]);
  const [isGeneratingSlogan, setIsGeneratingSlogan] = useState(false);
  const [isGeneratingMetaphor, setIsGeneratingMetaphor] = useState(false);
  const [sloganCategory, setSloganCategory] = useState<keyof typeof PRESET_SLOGANS_BY_CATEGORY>('hype');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);

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
  }, [data.username, data.totalTokens, data.locale, isZh, sloganCategory]);

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
    const cleaned = raw.trim().replace(/,/g, '');
    if (cleaned === '') {
      updateField('totalTokens', 0);
      return;
    }
    
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
    
    if (isNaN(num) || num < 0) num = 0;
    updateField('totalTokens', Math.round(num));
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateField('avatarValue', event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
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
    reader.readAsDataURL(file);
  }, []);

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
    const tokenText = data.totalTokens > 0 ? data.totalTokens.toLocaleString() : '0';
    return isZh
      ? `${data.username || '我'}本月用 AI 烧了 ${tokenText} token。\n${activeMetaphor}。\n这张卡是我准备发${platformInfo.labelZh}的，你也来生成一张：tokcard.dev\n#TokCard #AI战绩 #VibeCoding`
      : `${data.username || 'I'} burned ${tokenText} AI tokens this month.\n${activeMetaphor}.\nBuilt this one for ${platformInfo.label}. Make yours at tokcard.dev\n#TokCard #AIFlex #VibeCoding`;
  }, [activeMetaphor, data.totalTokens, data.username, isZh, platformInfo.label, platformInfo.labelZh]);

  const handleCopyShareCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareCaption || buildShareCaption());
      alert(isZh ? '分享文案已复制' : 'Share caption copied');
    } catch (err) {
      console.error('Copy failed:', err);
      alert(isZh ? '复制失败，请手动复制' : 'Copy failed, please copy manually');
    }
  }, [buildShareCaption, isZh, shareCaption]);

  const handleExport = useCallback(async () => {
    const el = document.getElementById(exportRenderId);
    if (!el) return;

    if (!isPreviewReady) {
      alert(isZh ? '图片仍在加载，请稍后再试。' : 'Images are still loading. Try again in a moment.');
      return;
    }

    setIsExporting(true);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      await waitForImagesToSettle(el);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

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
      
      if (!blob) throw new Error('Generation failed: null blob');

      const filename = `tokcard-${data.username || 'card'}-${data.platform}.png`;
      const nextShareCaption = buildShareCaption();
      let shared = false;

      // Only attempt share on mobile devices where it behaves predictably
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobileDevice && navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'TokCard',
            });
            shared = true;
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            setIsExporting(false);
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

      setShareCaption(nextShareCaption);
      setShowShareSheet(true);

    } catch (err) {
      console.error('Export failed:', err);
      // Give more specific error message if available
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(isZh 
        ? `下载失败 (${errMsg})\n\n可能原因：\n1. 浏览器拦截了下载\n2. 包含不受支持的外部图片\n\n请尝试：更换浏览器，或更换头像为 Emoji 后重试。` 
        : `Download failed: ${errMsg}. Try changing avatar or browser.`);
    } finally {
      setIsExporting(false);
    }
  }, [buildShareCaption, data.platform, data.username, isZh, downloadViaLink, exportRenderId, isPreviewReady, waitForImagesToSettle]);

  const MobileTabBar = () => (
    <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 py-3 bg-[#fbfbfd]/80 backdrop-blur-xl border-b border-[#d2d2d7]/30">
      <div className="flex gap-2">
        <button type="button"
          onClick={() => setActiveTab('edit')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === 'edit' ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}
        >
          {isZh ? '编辑' : 'Edit'}
        </button>
        <button type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === 'preview' ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}
        >
          {isZh ? '预览' : 'Preview'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-[#1d1d1f] bg-[#fbfbfd] selection:bg-[#0071e3] selection:text-white">
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
        {isMobile && <MobileTabBar />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">
          {/* Left: Form */}
          <div className={`space-y-8 min-w-0 ${isMobile && activeTab !== 'edit' ? 'hidden' : ''}`}>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
              {isZh ? '本月 AI 烧了多少？做一张能晒的。' : 'How hard did you burn AI this month? Make it shareable.'}
            </h1>

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
            </div>

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

            {/* Slogan */}
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
                {isZh ? '可放 GitHub、个人主页或项目链接。留空则不显示二维码。' : 'Add GitHub, portfolio, or project link. Leave empty to hide the QR code.'}
              </p>
            </div>

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
          </div>

          {/* Right: Card Preview */}
          <div className={`lg:sticky lg:top-24 lg:self-start relative min-w-0 ${isMobile && activeTab !== 'preview' ? 'hidden' : ''}`} ref={previewContainerRef}>
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

            {isMobile && activeTab === 'preview' && (
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
                  {isZh ? '复制后直接发朋友圈 / 小红书 / X。' : 'Copy it and post on WeChat, Xiaohongshu, or X.'}
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

            <textarea
              readOnly
              value={shareCaption}
              className="mt-5 h-44 w-full rounded-2xl border border-[#d1d5db] bg-[#f9fafb] p-4 text-sm leading-6 text-[#111827] focus:outline-none resize-none"
            />

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowShareSheet(false)}
                className="px-5 py-3 rounded-xl border border-[#d1d5db] bg-white text-[#1d1d1f] font-medium hover:bg-[#f9fafb]"
              >
                {isZh ? '稍后再说' : 'Maybe later'}
              </button>
              <button
                type="button"
                onClick={handleCopyShareCaption}
                className="px-5 py-3 rounded-xl bg-[#0071e3] text-white font-semibold hover:opacity-95"
              >
                {isZh ? '复制并去晒图' : 'Copy and post'}
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
          height: platformInfo.height,
          pointerEvents: 'none',
        }}
      >
        <div
          id={exportRenderId}
          style={{
            width: platformInfo.width,
            height: platformInfo.height,
            background: stageBackground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <CardRenderer data={data} renderId={`${exportRenderId}-card`} scale={exportCardScale} onImageReady={setIsPreviewReady} />
        </div>
      </div>
    </div>
  );
}