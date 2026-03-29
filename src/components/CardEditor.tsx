import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateSlogan, generateMetaphor, parseAIOptions } from '@/lib/deepseek';
import type { CardData, PlatformKey, ModelBreakdown } from '@/lib/card';
import { DEFAULT_CARD_DATA, PLATFORMS, CHANNELS } from '@/lib/card';
import { METAPHOR_CATEGORY_LABELS, type MetaphorCategory } from '@/lib/metaphor';
import { STYLE_TAGS } from '@/lib/titles';
import CardRenderer from './CardRenderer';
import { domToBlob } from 'modern-screenshot';

const PRESET_SLOGANS = [
  'Build with AI, ship like a factory',
  'Vibe coding all day, every day',
  'AI is my copilot, and I drive fast',
  '代码是写给机器的情书',
  'Shipping faster than ever',
  'I talk to AI more than humans',
];

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile detection and tab state
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Platform detection for download handling
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  // Container ref for responsive scaling
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.72);
  const [isPreviewReady, setIsPreviewReady] = useState(true);

  const DEEPSEEK_KEY = 'sk-1cf337ca01ee4cf7bb69593e119b7d2f';

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
    const calculateScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.clientWidth;
      const cardWidth = 540;
      const horizontalPadding = isMobile ? 24 : 12;
      const availableWidth = Math.max(containerWidth - horizontalPadding, 0);
      const maxScale = isMobile ? 0.74 : 0.86;
      const minScale = isMobile ? 0.44 : 0.62;
      const nextScale = Math.min(availableWidth / cardWidth, maxScale);
      setPreviewScale(Math.max(minScale, Math.min(nextScale, 1)));
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [isMobile]);

  const isZh = data.locale === 'zh';

  const handleGenerateSlogan = useCallback(async () => {
    setIsGeneratingSlogan(true);
    setAiSlogans([]);
    try {
      const result = await generateSlogan(data.username || 'developer', data.totalTokens, data.locale, DEEPSEEK_KEY);
      setAiSlogans(parseAIOptions(result));
    } catch (err) {
      console.error('AI slogan generation failed:', err);
    } finally {
      setIsGeneratingSlogan(false);
    }
  }, [data.username, data.totalTokens, data.locale]);

  const handleGenerateMetaphor = useCallback(async () => {
    setIsGeneratingMetaphor(true);
    setAiMetaphors([]);
    try {
      const tokensToUse = data.totalTokens > 0 ? data.totalTokens : 10000; // fallback if 0
      const result = await generateMetaphor(tokensToUse, data.locale, DEEPSEEK_KEY);
      setAiMetaphors(parseAIOptions(result));
    } catch (err) {
      console.error('AI metaphor generation failed:', err);
      alert(isZh ? '生成失败，请检查网络' : 'Generation failed, check network');
    } finally {
      setIsGeneratingMetaphor(false);
    }
  }, [data.totalTokens, data.locale, isZh]);

  const updateField = useCallback(<K extends keyof CardData>(key: K, value: CardData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

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

  const handleExport = useCallback(async () => {
    const el = document.getElementById('tokcard-render');
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

      const filename = `tokcard-${data.username || 'card'}.png`;
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
  }, [data.username, isZh, downloadViaLink, isPreviewReady, waitForImagesToSettle]);

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
              {isZh ? '生成你的 AI 名片' : 'Create Your AI Card'}
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
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'brand-light', label: isZh ? '晨曦白 (推荐)' : 'Dawn White (Rec)', preview: 'bg-[#fbfbfd] border-[#d2d2d7]' },
                  { value: 'brand-dark', label: isZh ? '午夜紫' : 'Midnight Violet', preview: 'bg-[#0f0f12] border-purple-500' },
                  { value: 'bold-violet', label: isZh ? '高亮紫' : 'Bold Violet', preview: 'bg-purple-700 border-amber-500' },
                  { value: 'mono-brutal', label: isZh ? '粗野黑白' : 'Mono Brutal', preview: 'bg-white border-black border-2' },
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
                        onClick={() => { updateField('slogan', s); setAiSlogans([]); }}
                        className="text-left text-sm px-4 py-2.5 bg-[#f5f5f7] rounded-lg text-[#1d1d1f] hover:bg-[#0071e3] hover:text-white transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESET_SLOGANS.map(s => (
                  <button type="button"
                    key={s}
                    onClick={() => updateField('slogan', s)}
                    className="text-xs px-3 py-1.5 bg-white border border-[#d2d2d7] rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
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
                <div className="mb-4 p-4 rounded-xl bg-white border border-[#0071e3]/30 shadow-sm">
                  <div className="text-xs font-medium mb-3 text-[#0071e3]">{isZh ? 'AI 生成的比喻 (可截图分享)' : 'AI Generated Metaphors'}</div>
                  <div className="flex flex-col gap-2">
                    {aiMetaphors.map((m, i) => (
                      <div key={i} className="text-sm px-4 py-2.5 bg-[#f5f5f7] rounded-lg text-[#1d1d1f]">
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(Object.entries(METAPHOR_CATEGORY_LABELS) as [MetaphorCategory, { zh: string; en: string }][]).map(([key, label]) => (
                  <button type="button"
                    key={key}
                    onClick={() => updateField('metaphorCategory', key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${data.metaphorCategory === key ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                  >
                    {isZh ? label.zh : label.en}
                  </button>
                ))}
              </div>
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
                <>{isZh ? '下载卡片 PNG' : 'Download Card PNG'}</>
              )}
            </button>
            {!isPreviewReady && (
              <p className="text-xs text-[#86868b] mt-3">
                {isZh ? '外部图片正在同步，完成后再导出会更稳定。' : 'External images are still syncing. Export works better after they finish loading.'}
              </p>
            )}
          </div>

          {/* Right: Card Preview */}
          <div className={`lg:sticky lg:top-24 lg:self-start relative min-w-0 ${isMobile && activeTab !== 'preview' ? 'hidden' : ''}`} ref={previewContainerRef}>
            <div className="text-sm font-medium text-[#86868b] mb-6 text-center">
              {isZh ? '实时预览' : 'Live Preview'}
              <span className="ml-2 text-xs opacity-70">({PLATFORMS[data.platform].width}×{PLATFORMS[data.platform].height})</span>
            </div>
            <div className="flex justify-center overflow-hidden" ref={cardRef}>
              <div style={{ width: 540 * previewScale, height: 720 * previewScale }}>
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: 540, height: 720 }}>
                  <CardRenderer data={data} onImageReady={setIsPreviewReady} />
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
                  {isExporting ? (isZh ? '生成中...' : 'Generating...') : !isPreviewReady ? (isZh ? '图片同步中...' : 'Syncing images...') : (isZh ? '下载卡片 PNG' : 'Download Card PNG')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}