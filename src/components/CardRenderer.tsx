import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as QRCode from 'qrcode';
import type { CardData } from '@/lib/card';
import {
  formatProofDateRange,
  formatTokens,
  formatTokensFull,
  getProofSourceLabel,
  getRankingSignalDescription,
  getRankingSignalLabel,
  getTrustTierLabel,
  normalizeTheme,
} from '@/lib/card';
import { calculateTitle, getRankTier } from '@/lib/titles';
import { getGrowthPercentage } from '@/lib/achievements';
import { getMetaphor } from '@/lib/metaphor';

interface CardRendererProps {
  data: CardData;
  scale?: number;
  renderId?: string;
  onImageReady?: (ready: boolean) => void;
}

const CHANNEL_ICONS: Record<string, string> = {
  claude: '🟠',
  gpt: '🟢',
  cursor: '🟣',
  deepseek: '🔵',
  gemini: '🔴',
  other: '⚪',
};

const imageDataUrlCache = new Map<string, string>();
const imageRequestCache = new Map<string, Promise<string>>();

const THEME_TOKENS = {
  'brand-dark': {
    bg: '#0f172a',
    text: '#f8fafc',
    textSecondary: '#dbe7ff',
    textDim: '#94a3b8',
    textMuted: '#64748b',
    accent: '#f59e0b',
    accent2: '#60a5fa',
    panelBg: 'rgba(15, 23, 42, 0.74)',
    panelBorder: 'rgba(148, 163, 184, 0.22)',
    barTrack: 'rgba(148, 163, 184, 0.10)',
    divider: 'rgba(148, 163, 184, 0.20)',
    avatarInner: '#111827',
  },
  'brand-light': {
    bg: '#fbfbfd',
    text: '#111827',
    textSecondary: '#334155',
    textDim: '#64748b',
    textMuted: '#94a3b8',
    accent: '#0071e3',
    accent2: '#38bdf8',
    panelBg: 'rgba(255,255,255,0.92)',
    panelBorder: 'rgba(15, 23, 42, 0.08)',
    barTrack: 'rgba(15, 23, 42, 0.04)',
    divider: 'rgba(15, 23, 42, 0.08)',
    avatarInner: '#ffffff',
  },
  'minimal-gray': {
    bg: '#f3f4f6',
    text: '#111827',
    textSecondary: '#374151',
    textDim: '#6b7280',
    textMuted: '#9ca3af',
    accent: '#111827',
    accent2: '#475569',
    panelBg: 'rgba(255,255,255,0.96)',
    panelBorder: '#d1d5db',
    barTrack: '#e5e7eb',
    divider: '#d1d5db',
    avatarInner: '#ffffff',
  },
} as const;

export default function CardRenderer({ data, scale = 1, renderId = 'tokcard-render', onImageReady }: CardRendererProps) {
  const title = useMemo(() => calculateTitle(data.totalTokens), [data.totalTokens]);
  const rankTier = useMemo(() => getRankTier(data.totalTokens), [data.totalTokens]);
  const growth = useMemo(() => getGrowthPercentage(data.totalTokens, data.lastMonthTokens), [data.totalTokens, data.lastMonthTokens]);
  const metaphor = useMemo(
    () => data.customMetaphor.trim() || getMetaphor(data.totalTokens, data.metaphorCategory, data.locale),
    [data.customMetaphor, data.totalTokens, data.metaphorCategory, data.locale]
  );

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [resolvedAvatar, setResolvedAvatar] = useState('');
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [resolvedBackground, setResolvedBackground] = useState('');
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const backgroundFetchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !data.qrcodeUrl) {
      setQrDataUrl('');
      return;
    }

    const qrTarget = data.qrcodeUrl.trim();
    if (!qrTarget) {
      setQrDataUrl('');
      return;
    }

    let qrUrl = '';
    try {
      if (qrTarget.startsWith('http://') || qrTarget.startsWith('https://')) {
        qrUrl = qrTarget;
      } else if (qrTarget.startsWith('/')) {
        qrUrl = new URL(qrTarget, window.location.origin).toString();
      } else {
        qrUrl = new URL(`https://${qrTarget}`).toString();
      }
    } catch {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(qrUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [data.qrcodeUrl]);

  const fetchImageAsBase64 = useCallback(async (url: string, signal: AbortSignal): Promise<string> => {
    const cached = imageDataUrlCache.get(url);
    if (cached) return cached;

    const pending = imageRequestCache.get(url);
    if (pending) return pending;

    const request = (async () => {
      const res = await fetch(url, { mode: 'cors', signal, cache: 'force-cache' });
      if (!res.ok) throw new Error('Network response was not ok');
      const blob = await res.blob();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            resolve(reader.result as string);
          } else {
            reject(new Error('FileReader returned null'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      imageDataUrlCache.set(url, base64);
      return base64;
    })();

    imageRequestCache.set(url, request);

    try {
      return await request;
    } finally {
      imageRequestCache.delete(url);
    }
  }, []);

  useEffect(() => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }

    if (data.avatarType === 'emoji' || !data.avatarValue) {
      setResolvedAvatar('');
      setIsImageLoading(false);
      return;
    }

    if (data.avatarValue.startsWith('data:')) {
      setResolvedAvatar(data.avatarValue);
      setIsImageLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchControllerRef.current = controller;

    setResolvedAvatar('');
    setIsImageLoading(true);

    const loadImage = async () => {
      try {
        let urlToFetch = data.avatarValue;

        if (data.avatarType === 'github') {
          const match = urlToFetch.match(/github\.com\/([^/.]+)\.png/);
          if (match && match[1]) {
            urlToFetch = `https://avatars.githubusercontent.com/${match[1]}?s=200`;
          }
        }

        const base64 = await fetchImageAsBase64(urlToFetch, controller.signal);
        if (!controller.signal.aborted) {
          setResolvedAvatar(base64);
          setIsImageLoading(false);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (!controller.signal.aborted) {
          if (data.avatarType === 'github') {
            try {
              const match = data.avatarValue.match(/github\.com\/([^/.]+)\.png/);
              const username = match?.[1] || 'tokcard';
              const fallbackUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}`;
              const fallbackBase64 = await fetchImageAsBase64(fallbackUrl, controller.signal);
              if (!controller.signal.aborted) {
                setResolvedAvatar(fallbackBase64);
                setIsImageLoading(false);
                return;
              }
            } catch {
              // ignore fallback failure
            }
          }
          setResolvedAvatar('');
          setIsImageLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      controller.abort();
    };
  }, [data.avatarType, data.avatarValue, fetchImageAsBase64]);

  useEffect(() => {
    if (backgroundFetchControllerRef.current) {
      backgroundFetchControllerRef.current.abort();
    }

    if (data.backgroundType === 'none' || !data.backgroundValue) {
      setResolvedBackground('');
      setIsBackgroundLoading(false);
      return;
    }

    if (data.backgroundValue.startsWith('data:')) {
      setResolvedBackground(data.backgroundValue);
      setIsBackgroundLoading(false);
      return;
    }

    const controller = new AbortController();
    backgroundFetchControllerRef.current = controller;

    setResolvedBackground('');
    setIsBackgroundLoading(true);

    fetchImageAsBase64(data.backgroundValue, controller.signal)
      .then((base64) => {
        if (!controller.signal.aborted) {
          setResolvedBackground(base64);
          setIsBackgroundLoading(false);
        }
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setResolvedBackground('');
          setIsBackgroundLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [data.backgroundType, data.backgroundValue, fetchImageAsBase64]);

  useEffect(() => {
    onImageReady?.(!isImageLoading && !isBackgroundLoading);
  }, [isImageLoading, isBackgroundLoading, onImageReady]);

  const isZh = data.locale === 'zh';
  const s = scale;
  const featuredProjects = data.projects.filter((project) => project.name && project.url).slice(0, 3);
  const primaryProjectName = data.primaryProjectName.trim() || featuredProjects[0]?.name || (isZh ? '未命名项目' : 'Untitled project');
  const primaryProjectPitch = data.primaryProjectPitch.trim() || data.slogan.trim() || (isZh ? '正在用 AI 推进中的项目' : 'An AI-powered project in motion');
  const primaryProjectUrl = data.primaryProjectUrl.trim() || featuredProjects[0]?.url || '';
  const primaryProjectDomain = (() => {
    if (!primaryProjectUrl) return '';
    try {
      return new URL(primaryProjectUrl).hostname.replace(/^www\./, '');
    } catch {
      return primaryProjectUrl.replace(/^https?:\/\//, '').split('/')[0] || '';
    }
  })();

  const tokenDisplay = data.totalTokens > 0 ? formatTokensFull(data.totalTokens) : '0';
  const tokenShort = data.totalTokens > 0 ? formatTokens(data.totalTokens) : '0';
  const trustTierLabel = getTrustTierLabel(data.trustTier, data.locale);
  const proofSourceLabel = data.proofSource ? getProofSourceLabel(data.proofSource, data.locale) : '';
  const proofRangeLabel = formatProofDateRange(data.proofDateRange, data.locale);
  const rankingSignalLabel = getRankingSignalLabel(rankTier, data.trustTier, data.locale);
  const rankingSignalDescription = getRankingSignalDescription(rankTier, data.trustTier, data.locale);
  const trustSummary = [trustTierLabel, rankingSignalLabel, proofSourceLabel, proofRangeLabel].filter(Boolean).join(' · ');

  const themeKey = normalizeTheme(data.theme);
  const tc = THEME_TOKENS[themeKey];

  const font = "'Plus Jakarta Sans', 'Noto Sans SC', system-ui, sans-serif";
  const cardBackground = data.backgroundType === 'preset' && data.backgroundValue ? data.backgroundValue : tc.bg;

  return (
    <div
      id={renderId}
      style={{
        width: 540 * s,
        minHeight: 720 * s,
        background: cardBackground,
        color: tc.text,
        fontFamily: font,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20 * s,
        border: themeKey === 'minimal-gray' ? '1px solid #e2e8f0' : `1px solid ${tc.panelBorder}`,
        boxShadow: themeKey === 'brand-dark'
          ? '0 0 40px rgba(15,23,42,0.18), 0 8px 32px rgba(0,0,0,0.16)'
          : '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 10 * s,
          borderRadius: 18 * s,
          border: '1px solid rgba(255,255,255,0.08)',
          pointerEvents: 'none',
          opacity: themeKey === 'brand-dark' ? 1 : 0.45,
        }}
      />

      {resolvedBackground && (
        <>
          <img
            src={resolvedBackground}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: themeKey === 'brand-dark' ? 0.22 : 0.14,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: themeKey === 'brand-dark'
                ? 'linear-gradient(180deg, rgba(9,9,14,0.20) 0%, rgba(9,9,14,0.44) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(255,255,255,0.84) 100%)',
            }}
          />
        </>
      )}

      {themeKey === 'brand-dark' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -90 * s,
              right: -50 * s,
              width: 280 * s,
              height: 280 * s,
              background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 52%, transparent 72%)',
              borderRadius: '50%',
              filter: `blur(${42 * s}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -70 * s,
              left: -40 * s,
              width: 240 * s,
              height: 240 * s,
              background: 'radial-gradient(circle, rgba(96,165,250,0.16) 0%, rgba(96,165,250,0.04) 52%, transparent 72%)',
              borderRadius: '50%',
              filter: `blur(${38 * s}px)`,
            }}
          />
        </>
      )}

      {themeKey === 'brand-light' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -110 * s,
              right: -60 * s,
              width: 300 * s,
              height: 300 * s,
              background: 'radial-gradient(circle, rgba(0,113,227,0.06) 0%, transparent 62%)',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -90 * s,
              left: -50 * s,
              width: 240 * s,
              height: 240 * s,
              background: 'radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 60%)',
              borderRadius: '50%',
            }}
          />
        </>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          padding: `${32 * s}px ${36 * s}px ${28 * s}px`,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 * s }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6 * s,
                padding: `${5 * s}px ${10 * s}px`,
                borderRadius: 999,
                background: tc.panelBg,
                border: `1px solid ${tc.panelBorder}`,
                fontSize: 10 * s,
                fontWeight: 700,
                color: tc.textDim,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span>{isZh ? 'AI 战绩卡' : 'AI CARD'}</span>
              <span style={{ opacity: 0.55 }}>·</span>
              <span>{tokenShort}</span>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6 * s,
                padding: `${5 * s}px ${10 * s}px`,
                borderRadius: 999,
                background: `${rankTier.accent}14`,
                border: `1px solid ${rankTier.accent}30`,
                fontSize: 10 * s,
                fontWeight: 800,
                color: rankTier.accent,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ lineHeight: 1 }}>{rankTier.badge}</span>
              <span>{isZh ? rankTier.label : rankTier.labelEn}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 * s }}>
            <div
              style={{
                width: 58 * s,
                height: 58 * s,
                borderRadius: '50%',
                padding: 3 * s,
                background: `linear-gradient(135deg, ${tc.accent}, ${tc.accent2})`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: tc.avatarInner,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26 * s,
                  overflow: 'hidden',
                }}
              >
                {data.avatarType === 'emoji' ? (
                  <span>{data.avatarValue || '🤖'}</span>
                ) : (data.avatarType === 'photo' || data.avatarType === 'github' || data.avatarType === 'cartoon') ? (
                  resolvedAvatar ? (
                    <img
                      src={resolvedAvatar}
                      crossOrigin="anonymous"
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : isImageLoading ? (
                    <span
                      className="skeleton-shimmer"
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        borderRadius: '50%',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 22 * s, fontWeight: 800, color: tc.textDim }}>
                      {(data.username || 'A').charAt(0).toUpperCase()}
                    </span>
                  )
                ) : (
                  <span style={{ fontSize: 22 * s, fontWeight: 800, color: tc.textDim }}>
                    {(data.username || 'A').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9 * s, fontWeight: 700, color: tc.textMuted, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {isZh ? '开发者身份' : 'Builder identity'}
              </div>
              <div style={{ marginTop: 4 * s, overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 24 * s,
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    color: tc.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {data.username || 'anonymous'}
                </span>
              </div>
              <div style={{ marginTop: 8 * s, fontSize: 10 * s, color: tc.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {isZh ? 'Token · Rank · Project' : 'Token · Rank · Project'}
              </div>
            </div>
          </div>

          <div style={{ height: 1.5, background: tc.divider, marginTop: 18 * s }} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 * s, padding: `${12 * s}px 0` }}>
          <div
            style={{
              background: tc.panelBg,
              border: `1px solid ${tc.panelBorder}`,
              borderRadius: 16 * s,
              padding: `${20 * s}px ${22 * s}px ${16 * s}px`,
              boxShadow: `0 12px 32px ${title.glowColor}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 * s }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11 * s, fontWeight: 800, color: tc.textMuted, textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                  {isZh ? '本月 Token' : 'Monthly tokens'}
                </div>
                <div
                  style={{
                    marginTop: 10 * s,
                    fontSize: 48 * s,
                    fontWeight: 900,
                    lineHeight: 0.96,
                    letterSpacing: '-0.05em',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'transparent',
                    backgroundImage: `linear-gradient(135deg, ${title.color}, ${rankTier.accent})`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    textShadow: themeKey === 'brand-dark'
                      ? `0 0 30px rgba(245,158,11,0.28), 0 0 60px rgba(96,165,250,0.12)`
                      : 'none',
                  }}
                >
                  {tokenDisplay}
                </div>
                <div style={{ marginTop: 6 * s, fontSize: 12 * s, color: tc.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  TOKENS
                </div>
              </div>
              <div
                style={{
                  minWidth: 86 * s,
                  padding: `${9 * s}px ${11 * s}px`,
                  borderRadius: 12 * s,
                  border: `1px solid ${rankTier.accent}33`,
                  background: `${rankTier.accent}14`,
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: 10 * s, color: tc.textMuted, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                  {isZh ? '排名信号' : 'Ranking'}
                </div>
                <div style={{ marginTop: 4 * s, fontSize: 16 * s, fontWeight: 900, color: rankTier.accent, whiteSpace: 'nowrap' }}>
                  {rankTier.badge} {isZh ? rankTier.label : rankTier.labelEn}
                </div>
                <div style={{ marginTop: 4 * s, fontSize: 9 * s, color: tc.textDim }}>
                  {growth > 0 ? `${growth > 999 ? '999+' : growth}% ${isZh ? '较上月' : 'vs last month'}` : rankingSignalDescription}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 * s, display: 'flex', flexWrap: 'wrap', gap: 8 * s }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5 * s,
                  padding: `${6 * s}px ${10 * s}px`,
                  borderRadius: 999,
                  background: `${rankTier.accent}14`,
                  border: `1px solid ${rankTier.accent}30`,
                  fontSize: 10 * s,
                  fontWeight: 800,
                  color: rankTier.accent,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <span>{rankTier.badge}</span>
                <span>{rankingSignalLabel}</span>
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5 * s,
                  padding: `${6 * s}px ${10 * s}px`,
                  borderRadius: 999,
                  background: tc.barTrack,
                  border: `1px solid ${tc.panelBorder}`,
                  fontSize: 10 * s,
                  fontWeight: 700,
                  color: tc.textSecondary,
                }}
              >
                <span>{CHANNEL_ICONS[data.channel] || '⚪'}</span>
                <span>{tokenShort}</span>
              </span>
            </div>
          </div>

          <div
            style={{
              background: tc.panelBg,
              border: `1px solid ${tc.panelBorder}`,
              borderRadius: 16 * s,
              padding: `${16 * s}px ${18 * s}px`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 * s }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10 * s, fontWeight: 800, color: tc.textMuted, textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  {isZh ? '主项目' : 'Main project'}
                </div>
                <div style={{ marginTop: 8 * s, fontSize: 26 * s, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', color: tc.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {primaryProjectName}
                </div>
                <div style={{ marginTop: 8 * s, fontSize: 13 * s, lineHeight: 1.6, color: tc.textSecondary }}>
                  {primaryProjectPitch}
                </div>
              </div>
              {primaryProjectDomain && (
                <div
                  style={{
                    flexShrink: 0,
                    maxWidth: 120 * s,
                    padding: `${7 * s}px ${10 * s}px`,
                    borderRadius: 999,
                    border: `1px solid ${tc.panelBorder}`,
                    background: tc.barTrack,
                    fontSize: 10 * s,
                    fontWeight: 800,
                    color: tc.textDim,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {primaryProjectDomain}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              background: tc.panelBg,
              border: `1px solid ${tc.panelBorder}`,
              borderRadius: 16 * s,
              padding: `${14 * s}px ${18 * s}px`,
            }}
          >
            <div style={{ fontSize: 10 * s, fontWeight: 800, color: tc.textMuted, textTransform: 'uppercase', letterSpacing: '0.16em' }}>
              {isZh ? 'AI 比喻' : 'AI metaphor'}
            </div>
            <div style={{ marginTop: 8 * s, display: 'flex', alignItems: 'flex-start', gap: 6 * s }}>
              <span style={{ fontSize: 22 * s, lineHeight: 1, color: `${tc.accent}35`, fontFamily: 'Georgia, "Times New Roman", serif', marginTop: -2 * s }}>
                “
              </span>
              <span style={{ fontSize: 14 * s, fontWeight: 600, lineHeight: 1.6, color: tc.textSecondary }}>
                {metaphor}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ height: 1, background: tc.divider, marginBottom: 14 * s }} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ maxWidth: qrDataUrl ? '72%' : '100%' }}>
              <div style={{ fontSize: 9 * s, color: tc.textMuted, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 * s }}>
                {isZh ? '可传播个人名片' : 'Share-ready identity card'}
              </div>
              <div style={{ fontSize: 9 * s, color: tc.textDim, marginBottom: 6 * s, letterSpacing: '0.03em', lineHeight: 1.4 }}>
                {trustSummary}
              </div>
              <div style={{ fontSize: 16 * s, fontWeight: 900, letterSpacing: '-0.03em', color: tc.text, display: 'flex', alignItems: 'center', gap: 6 * s }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20 * s,
                    height: 20 * s,
                    borderRadius: 5 * s,
                    background: `linear-gradient(135deg, ${tc.accent}, ${tc.accent2})`,
                    fontSize: 11 * s,
                    fontWeight: 900,
                    color: '#fff',
                  }}
                >
                  T
                </span>
                tokcard.dev
              </div>
            </div>

            {qrDataUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: 88 * s,
                    height: 88 * s,
                    borderRadius: 10 * s,
                    overflow: 'hidden',
                    background: '#ffffff',
                    padding: 4 * s,
                    boxShadow: themeKey === 'brand-dark'
                      ? '0 0 16px rgba(245,158,11,0.18), 0 2px 8px rgba(0,0,0,0.2)'
                      : '0 1px 4px rgba(0,0,0,0.06)',
                    border: themeKey === 'minimal-gray' ? '1px solid #e5e7eb' : 'none',
                  }}
                >
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'auto' }}
                  />
                </div>
                <div style={{ fontSize: 8 * s, color: tc.textMuted, marginTop: 5 * s, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase', maxWidth: 100 * s }}>
                  {isZh ? '扫码看卡片和项目' : 'Scan to see card & projects'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
