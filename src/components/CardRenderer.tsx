import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as QRCode from 'qrcode';
import type { CardData } from '@/lib/card';
import {
  formatTokenValueEstimate,
  formatTokens,
  formatTokensFull,
  getProofSourceLabel,
  getRankingSignalDescription,
  getRankingSignalLabel,
  getTokenWindowLabel,
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
    glowA: 'rgba(245,158,11,0.18)',
    glowB: 'rgba(96,165,250,0.16)',
  },
  'brand-light': {
    bg: '#fbfbfd',
    text: '#111827',
    textSecondary: '#334155',
    textDim: '#526072',
    textMuted: '#667085',
    accent: '#0071e3',
    accent2: '#38bdf8',
    panelBg: 'rgba(255,255,255,0.92)',
    panelBorder: 'rgba(15, 23, 42, 0.08)',
    barTrack: 'rgba(15, 23, 42, 0.04)',
    divider: 'rgba(15, 23, 42, 0.08)',
    avatarInner: '#ffffff',
    glowA: 'rgba(0,113,227,0.08)',
    glowB: 'rgba(56,189,248,0.07)',
  },
  'minimal-gray': {
    bg: '#f3f4f6',
    text: '#111827',
    textSecondary: '#374151',
    textDim: '#556070',
    textMuted: '#6b7280',
    accent: '#111827',
    accent2: '#475569',
    panelBg: 'rgba(255,255,255,0.96)',
    panelBorder: '#d1d5db',
    barTrack: '#e5e7eb',
    divider: '#d1d5db',
    avatarInner: '#ffffff',
    glowA: 'rgba(148,163,184,0.06)',
    glowB: 'rgba(148,163,184,0.04)',
  },
  'velvet-night': {
    bg: '#140f24',
    text: '#fdf4ff',
    textSecondary: '#ead7ff',
    textDim: '#c4b5fd',
    textMuted: '#a78bfa',
    accent: '#a855f7',
    accent2: '#f472b6',
    panelBg: 'rgba(24, 18, 42, 0.76)',
    panelBorder: 'rgba(216, 180, 254, 0.22)',
    barTrack: 'rgba(216, 180, 254, 0.10)',
    divider: 'rgba(216, 180, 254, 0.18)',
    avatarInner: '#1a122d',
    glowA: 'rgba(168,85,247,0.20)',
    glowB: 'rgba(244,114,182,0.18)',
  },
  'aurora-mint': {
    bg: '#f5fffb',
    text: '#0f172a',
    textSecondary: '#1f3b36',
    textDim: '#3f6a61',
    textMuted: '#5b7f77',
    accent: '#0f766e',
    accent2: '#38bdf8',
    panelBg: 'rgba(255,255,255,0.92)',
    panelBorder: 'rgba(15, 118, 110, 0.12)',
    barTrack: 'rgba(15, 118, 110, 0.05)',
    divider: 'rgba(15, 118, 110, 0.10)',
    avatarInner: '#ffffff',
    glowA: 'rgba(20,184,166,0.10)',
    glowB: 'rgba(56,189,248,0.08)',
  },
  'sunset-paper': {
    bg: '#fff8f1',
    text: '#111827',
    textSecondary: '#4b5563',
    textDim: '#7c5a43',
    textMuted: '#9a6b52',
    accent: '#ea580c',
    accent2: '#ec4899',
    panelBg: 'rgba(255,255,255,0.92)',
    panelBorder: 'rgba(234, 88, 12, 0.12)',
    barTrack: 'rgba(234, 88, 12, 0.05)',
    divider: 'rgba(234, 88, 12, 0.10)',
    avatarInner: '#ffffff',
    glowA: 'rgba(249,115,22,0.10)',
    glowB: 'rgba(236,72,153,0.08)',
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

  const tokenDisplay = data.totalTokens > 0 ? formatTokens(data.totalTokens, data.locale) : '0';
  const tokenShort = data.totalTokens > 0 ? formatTokens(data.totalTokens, data.locale) : '0';
  const tokenFullDisplay = data.totalTokens > 0 ? formatTokensFull(data.totalTokens, data.locale) : '0';
  const tokenValueEstimate = data.totalTokens > 0 ? formatTokenValueEstimate(data.totalTokens, data.locale) : (isZh ? '≈ $0 / ¥0' : '≈ $0 / CN¥0');
  const tokenWindowLabel = getTokenWindowLabel(data.tokenWindow, data.locale);
  const trustTierLabel = getTrustTierLabel(data.trustTier, data.locale);
  const proofSourceLabel = data.proofSource ? getProofSourceLabel(data.proofSource, data.locale) : '';
  const rankingSignalLabel = getRankingSignalLabel(rankTier, data.trustTier, data.locale);
  const rankingSignalDescription = getRankingSignalDescription(rankTier, data.trustTier, data.locale);
  const aheadPercent = typeof data.percentile === 'number' ? Math.max(0, 100 - data.percentile) : null;
  const rankHeadline = typeof data.globalRank === 'number' && data.globalRank > 0
    ? `#${data.globalRank}`
    : typeof data.percentile === 'number' && data.percentile > 0
      ? (isZh ? `前 ${Math.max(1, data.percentile)}%` : `Top ${Math.max(1, data.percentile)}%`)
      : rankingSignalLabel;
  const rankFootnote = typeof data.globalRank === 'number' && data.globalRank > 0 && aheadPercent !== null
    ? (isZh ? `超过 ${aheadPercent}% 用户` : `Ahead of ${aheadPercent}% of builders`)
    : rankingSignalDescription;
  const trustSummary = [trustTierLabel, proofSourceLabel].filter(Boolean).join(' · ');
  const trustBadgeText = proofSourceLabel ? `${trustTierLabel} · ${proofSourceLabel}` : trustTierLabel;
  const messageLine = data.slogan.trim() || metaphor;

  const themeKey = normalizeTheme(data.theme);
  const tc = THEME_TOKENS[themeKey];
  const isDarkTheme = themeKey === 'brand-dark' || themeKey === 'velvet-night';
  const isMinimalTheme = themeKey === 'minimal-gray';
  const hasSoftGlow = !isDarkTheme && !isMinimalTheme;

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
        border: isMinimalTheme ? '1px solid #e2e8f0' : `1px solid ${tc.panelBorder}`,
        boxShadow: isDarkTheme
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
          opacity: isDarkTheme ? 1 : 0.45,
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
              opacity: isDarkTheme ? 0.22 : 0.14,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: isDarkTheme
                ? 'linear-gradient(180deg, rgba(9,9,14,0.20) 0%, rgba(9,9,14,0.44) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(255,255,255,0.84) 100%)',
            }}
          />
        </>
      )}

      {isDarkTheme && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -90 * s,
              right: -50 * s,
              width: 280 * s,
              height: 280 * s,
              background: `radial-gradient(circle, ${tc.glowA} 0%, transparent 68%)`,
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
              background: `radial-gradient(circle, ${tc.glowB} 0%, transparent 68%)`,
              borderRadius: '50%',
              filter: `blur(${38 * s}px)`,
            }}
          />
        </>
      )}

      {hasSoftGlow && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -110 * s,
              right: -60 * s,
              width: 300 * s,
              height: 300 * s,
              background: `radial-gradient(circle, ${tc.glowA} 0%, transparent 62%)`,
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
              background: `radial-gradient(circle, ${tc.glowB} 0%, transparent 60%)`,
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
                gap: 3 * s,
                padding: `${4 * s}px ${8 * s}px`,
                borderRadius: 999,
                background: tc.panelBg,
                border: `1px solid ${tc.panelBorder}`,
                fontSize: 8.5 * s,
                fontWeight: 700,
                color: tc.textDim,
                letterSpacing: '0.03em',
                flexWrap: 'nowrap',
                maxWidth: '64%',
                lineHeight: 1.15,
                overflow: 'hidden',
              }}
            >
              <span style={{ flexShrink: 0 }}>{isZh ? 'TokCard' : 'TokCard'}</span>
              <span style={{ opacity: 0.55, flexShrink: 0 }}>·</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tokenShort}</span>
            </div>
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
                fontWeight: 800,
                color: tc.textSecondary,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ lineHeight: 1 }}>{CHANNEL_ICONS[data.channel] || '⚪'}</span>
              <span>{data.channel}</span>
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
                {isZh ? 'Builder' : 'Builder'}
              </div>
              <div style={{ marginTop: 4 * s, overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 20 * s,
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    color: tc.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {data.username || 'anonymous'}
                </span>
              </div>
              <div style={{ marginTop: 8 * s, fontSize: 10 * s, color: tc.textDim, letterSpacing: '0.04em' }}>
                {isZh ? 'Token · 项目 · 排名' : 'Token · Project · Rank'}
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
                  {isZh ? `${tokenWindowLabel} Token` : `${tokenWindowLabel} tokens`}
                </div>
                <div
                  style={{
                    marginTop: 10 * s,
                    fontSize: 40 * s,
                    fontWeight: 900,
                    lineHeight: 0.94,
                    letterSpacing: '-0.05em',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'transparent',
                    backgroundImage: `linear-gradient(135deg, ${title.color}, ${rankTier.accent})`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    textShadow: isDarkTheme
                      ? `0 0 30px ${tc.glowA}, 0 0 60px ${tc.glowB}`
                      : 'none',
                  }}
                >
                  {tokenDisplay}
                </div>
                <div style={{ marginTop: 6 * s, fontSize: 12 * s, color: tc.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  TOKENS
                </div>
                <div style={{ marginTop: 8 * s, fontSize: 11 * s, color: tc.textSecondary, lineHeight: 1.6 }}>
                  {tokenValueEstimate}
                </div>
                <div style={{ marginTop: 4 * s, fontSize: 10 * s, color: tc.textMuted, lineHeight: 1.5 }}>
                  {isZh ? `完整值 ${tokenFullDisplay}` : `${tokenFullDisplay} total`}
                </div>
              </div>
              <div
                style={{
                  minWidth: 110 * s,
                  maxWidth: 110 * s,
                  padding: `${9 * s}px ${11 * s}px`,
                  borderRadius: 12 * s,
                  border: `1px solid ${rankTier.accent}33`,
                  background: `${rankTier.accent}14`,
                  textAlign: 'right',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 10 * s, color: tc.textMuted, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                  {isZh ? '排名' : 'Ranking'}
                </div>
                <div style={{ marginTop: 4 * s, fontSize: 15 * s, fontWeight: 900, color: rankTier.accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rankHeadline}
                </div>
                <div style={{ marginTop: 4 * s, fontSize: 9 * s, color: tc.textDim }}>
                  {typeof data.globalRank === 'number' && data.globalRank > 0
                    ? rankFootnote
                    : growth > 0
                      ? `${growth > 999 ? '999+' : growth}% ${isZh ? '较上月' : 'vs last month'}`
                      : rankFootnote}
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
                  background: tc.barTrack,
                  border: `1px solid ${tc.panelBorder}`,
                  fontSize: 10 * s,
                  fontWeight: 700,
                  color: tc.textSecondary,
                }}
              >
                <span>{CHANNEL_ICONS[data.channel] || '⚪'}</span>
                <span>{data.channel}</span>
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
                <span>{tokenWindowLabel}</span>
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
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trustBadgeText}</span>
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
                <div style={{ marginTop: 8 * s, fontSize: 13 * s, lineHeight: 1.6, color: tc.textSecondary, maxHeight: 44 * s, overflow: 'hidden' }}>
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
              {isZh ? '传播钩子' : 'Social hook'}
            </div>
            <div style={{ marginTop: 8 * s, fontSize: 14 * s, fontWeight: 600, lineHeight: 1.6, color: tc.textSecondary }}>
              {messageLine}
            </div>
          </div>
        </div>

        <div>
          <div style={{ height: 1, background: tc.divider, marginBottom: 14 * s }} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ maxWidth: qrDataUrl ? '72%' : '100%', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 9 * s, color: tc.textMuted, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 * s }}>
                {isZh ? '可传播个人名片' : 'Share-ready identity card'}
              </div>
              <div style={{ fontSize: 10 * s, color: tc.textDim, marginTop: 6 * s, letterSpacing: '0.03em', lineHeight: 1.5, maxHeight: 30 * s, overflow: 'hidden' }}>
                {trustSummary || (isZh ? 'Token 和项目会一起被看见。' : 'Tokens and project travel together.')}
              </div>
              <div style={{ marginTop: 10 * s, fontSize: 16 * s, fontWeight: 900, letterSpacing: '-0.03em', color: tc.text, display: 'flex', alignItems: 'center', gap: 6 * s, minWidth: 0 }}>
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
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>tokcard.dev</span>
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
                    boxShadow: isDarkTheme
                      ? `0 0 16px ${tc.glowA}, 0 2px 8px rgba(0,0,0,0.2)`
                      : '0 1px 4px rgba(0,0,0,0.06)',
                    border: isMinimalTheme ? '1px solid #e5e7eb' : 'none',
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
