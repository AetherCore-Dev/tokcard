import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import * as QRCode from 'qrcode';
import type { CardData } from '@/lib/card';
import { buildSharedCardUrl, formatTokens, formatTokensFull } from '@/lib/card';
import { calculateTitle, getRandomTags } from '@/lib/titles';
import { getMetaphor } from '@/lib/metaphor';
import { CHANNELS } from '@/lib/card';

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

export default function CardRenderer({ data, scale = 1, renderId = 'tokcard-render', onImageReady }: CardRendererProps) {
  const title = calculateTitle(data.totalTokens);
  const tags = useMemo(() => getRandomTags(2), []);
  const metaphor = useMemo(
    () => data.customMetaphor.trim() || getMetaphor(data.totalTokens, data.metaphorCategory, data.locale),
    [data.customMetaphor, data.totalTokens, data.metaphorCategory, data.locale]
  );

  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Determine QR colors based on theme
  const qrColors = useMemo(() => {
    switch (data.theme) {
      case 'brand-dark': return { dark: '#f59e0b', light: '#171720' };
      case 'brand-light': return { dark: '#0071e3', light: '#ffffff' };
      case 'bold-violet': return { dark: '#1e1e28', light: '#f59e0b' };
      case 'mono-brutal': return { dark: '#000000', light: '#ffffff' };
      case 'terminal-green': return { dark: '#22c55e', light: '#07130c' };
      case 'cyberpunk-neon': return { dark: '#ff4fd8', light: '#14081f' };
      case 'gradient-dream': return { dark: '#5b7cff', light: '#ffffff' };
      case 'sunset-warm': return { dark: '#ff7a45', light: '#fff5ef' };
      case 'ocean-blue': return { dark: '#38bdf8', light: '#081421' };
      case 'minimal-gray': return { dark: '#111827', light: '#ffffff' };
      default: return { dark: '#f59e0b', light: '#171720' };
    }
  }, [data.theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !data.qrcodeUrl) {
      setQrDataUrl('');
      return;
    }

    const sharedUrl = buildSharedCardUrl(data, window.location.origin);
    if (!sharedUrl) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(sharedUrl, {
      width: 256,
      margin: 1,
      color: qrColors,
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [data, qrColors]);

  
  // --- PRELOAD EXTERNAL IMAGES FOR SAFE EXPORT ---
  const [resolvedAvatar, setResolvedAvatar] = useState<string>('');
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [resolvedBackground, setResolvedBackground] = useState<string>('');
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const backgroundFetchControllerRef = useRef<AbortController | null>(null);

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
    // Abort any previous request
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }

    // Handle emoji or empty avatar
    if (data.avatarType === 'emoji' || !data.avatarValue) {
      setResolvedAvatar('');
      setIsImageLoading(false);
      return;
    }
    
    // Handle data URLs (already base64)
    if (data.avatarValue.startsWith('data:')) {
      setResolvedAvatar(data.avatarValue);
      setIsImageLoading(false);
      return;
    }

    // Create new abort controller
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    setResolvedAvatar('');
    setIsImageLoading(true);

    const loadImage = async () => {
      try {
        let urlToFetch = data.avatarValue;
        let isGithubUrl = false;
        
        // Handle Github avatars - use direct URL with size param for faster load
        if (data.avatarType === 'github') {
          const match = urlToFetch.match(/github\.com\/([^/.]+)\.png/);
          if (match && match[1]) {
            // Use GitHub's avatar CDN directly with size param
            urlToFetch = `https://avatars.githubusercontent.com/${match[1]}?s=200`;
            isGithubUrl = true;
          }
        }

        const base64 = await fetchImageAsBase64(urlToFetch, controller.signal);
        if (!controller.signal.aborted) {
          setResolvedAvatar(base64);
          setIsImageLoading(false);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('Failed to preload avatar, using local fallback:', err);
        if (!controller.signal.aborted) {
          // For failed GitHub avatars, try DiceBear fallback
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
            } catch (fallbackErr) {
              console.warn('GitHub fallback also failed:', fallbackErr);
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
        console.warn('Failed to preload background image:', err);
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
  // ----------------------------------------------

  const isZh = data.locale === 'zh';
  const s = scale;

  const channelInfo = CHANNELS.find((c) => c.value === data.channel) || CHANNELS[5];
  const estimatedCost = Math.round(data.totalTokens * 0.000003);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Compact token display for large numbers
  const tokenDisplay = data.totalTokens > 0 ? formatTokensFull(data.totalTokens) : '0';
  const tokenShort = data.totalTokens > 0 ? formatTokens(data.totalTokens) : '0';

  const tc = {
    'brand-dark': {
      bg: 'oklch(12% 0.01 280)',
      text: 'oklch(95% 0.01 280)',
      textSecondary: 'oklch(85% 0.02 280)',
      textDim: 'oklch(65% 0.02 280)',
      textMuted: 'oklch(50% 0.02 280)',
      accent: 'oklch(75% 0.16 55)',
      accent2: 'oklch(65% 0.18 280)',
      accent3: 'oklch(88% 0.08 55)',
      panelBg: 'oklch(16% 0.015 280)',
      panelBorder: 'oklch(22% 0.02 280)',
      barTrack: 'oklch(20% 0.015 280)',
      divider: 'oklch(25% 0.02 280)',
    },
    'brand-light': {
      bg: '#fbfbfd',
      text: '#1d1d1f',
      textSecondary: '#424245',
      textDim: '#86868b',
      textMuted: '#a1a1a6',
      accent: '#0071e3',
      accent2: '#2997ff',
      accent3: '#0077ed',
      panelBg: '#ffffff',
      panelBorder: 'rgba(0,0,0,0.06)',
      barTrack: 'rgba(0,0,0,0.04)',
      divider: 'rgba(0,0,0,0.06)',
    },
    'bold-violet': {
      bg: 'oklch(65% 0.18 280)',
      text: 'oklch(98% 0.01 280)',
      textSecondary: 'oklch(90% 0.02 280)',
      textDim: 'oklch(85% 0.05 280)',
      textMuted: 'oklch(75% 0.08 280)',
      accent: 'oklch(85% 0.16 55)',
      accent2: 'oklch(95% 0.01 280)',
      accent3: 'oklch(45% 0.20 280)',
      panelBg: 'oklch(60% 0.18 280)',
      panelBorder: 'oklch(55% 0.18 280)',
      barTrack: 'oklch(55% 0.18 280)',
      divider: 'oklch(55% 0.18 280)',
    },
    'mono-brutal': {
      bg: '#ffffff',
      text: '#000000',
      textSecondary: '#111111',
      textDim: '#333333',
      textMuted: '#555555',
      accent: '#000000',
      accent2: '#000000',
      accent3: '#000000',
      panelBg: '#ffffff',
      panelBorder: '#000000',
      barTrack: '#eeeeee',
      divider: '#000000',
    },
    'terminal-green': {
      bg: '#07130c',
      text: '#d8ffe7',
      textSecondary: '#a7f3c5',
      textDim: '#63d98d',
      textMuted: '#3d8b5d',
      accent: '#22c55e',
      accent2: '#86efac',
      accent3: '#14532d',
      panelBg: 'rgba(6, 33, 18, 0.9)',
      panelBorder: 'rgba(34,197,94,0.28)',
      barTrack: 'rgba(34,197,94,0.12)',
      divider: 'rgba(34,197,94,0.22)',
    },
    'cyberpunk-neon': {
      bg: '#14081f',
      text: '#fff6ff',
      textSecondary: '#f4c7ff',
      textDim: '#ff8dd8',
      textMuted: '#b46ad2',
      accent: '#ff4fd8',
      accent2: '#7c4dff',
      accent3: '#20f6ff',
      panelBg: 'rgba(33, 12, 51, 0.88)',
      panelBorder: 'rgba(255,79,216,0.28)',
      barTrack: 'rgba(124,77,255,0.16)',
      divider: 'rgba(255,79,216,0.20)',
    },
    'gradient-dream': {
      bg: 'linear-gradient(135deg, #5b7cff 0%, #8e44ff 50%, #ff5bbd 100%)',
      text: '#ffffff',
      textSecondary: 'rgba(255,255,255,0.92)',
      textDim: 'rgba(255,255,255,0.74)',
      textMuted: 'rgba(255,255,255,0.62)',
      accent: '#fff2a8',
      accent2: '#ffffff',
      accent3: '#7f5dff',
      panelBg: 'rgba(255,255,255,0.12)',
      panelBorder: 'rgba(255,255,255,0.18)',
      barTrack: 'rgba(255,255,255,0.12)',
      divider: 'rgba(255,255,255,0.18)',
    },
    'sunset-warm': {
      bg: '#1f0f08',
      text: '#fff5ef',
      textSecondary: '#ffd8c2',
      textDim: '#ffb18a',
      textMuted: '#c88360',
      accent: '#ff7a45',
      accent2: '#ffb347',
      accent3: '#7a2b17',
      panelBg: 'rgba(54, 23, 15, 0.88)',
      panelBorder: 'rgba(255,122,69,0.24)',
      barTrack: 'rgba(255,179,71,0.12)',
      divider: 'rgba(255,122,69,0.18)',
    },
    'ocean-blue': {
      bg: '#081421',
      text: '#eef8ff',
      textSecondary: '#c4e5ff',
      textDim: '#7cc7ff',
      textMuted: '#5a8aa8',
      accent: '#38bdf8',
      accent2: '#1d4ed8',
      accent3: '#0f3a5b',
      panelBg: 'rgba(10, 30, 45, 0.86)',
      panelBorder: 'rgba(56,189,248,0.24)',
      barTrack: 'rgba(56,189,248,0.10)',
      divider: 'rgba(56,189,248,0.16)',
    },
    'minimal-gray': {
      bg: '#f3f4f6',
      text: '#111827',
      textSecondary: '#374151',
      textDim: '#6b7280',
      textMuted: '#9ca3af',
      accent: '#111827',
      accent2: '#4b5563',
      accent3: '#e5e7eb',
      panelBg: '#ffffff',
      panelBorder: '#d1d5db',
      barTrack: '#e5e7eb',
      divider: '#d1d5db',
    },
  }[data.theme] || {
    bg: 'oklch(12% 0.01 280)', text: 'oklch(95% 0.01 280)', textSecondary: 'oklch(85% 0.02 280)', textDim: 'oklch(65% 0.02 280)', textMuted: 'oklch(50% 0.02 280)', accent: 'oklch(75% 0.16 55)', accent2: 'oklch(65% 0.18 280)', accent3: 'oklch(88% 0.08 55)', panelBg: 'oklch(16% 0.015 280)', panelBorder: 'oklch(22% 0.02 280)', barTrack: 'oklch(20% 0.015 280)', divider: 'oklch(25% 0.02 280)'
  };

  const font = "'Plus Jakarta Sans', 'Noto Sans SC', system-ui, sans-serif";

  return (
    <div
      id={renderId}
      style={{
        width: 540 * s,
        height: 720 * s,
        background: tc.bg,
        color: tc.text,
        fontFamily: font,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: data.theme === 'mono-brutal' ? 0 : 20 * s,
        border: data.theme === 'mono-brutal'
          ? `3px solid ${tc.accent}`
          : data.theme === 'minimal-gray'
            ? '1px solid #e2e8f0'
            : `1px solid ${tc.panelBorder}`,
        boxShadow: data.theme === 'brand-dark'
          ? '0 0 40px oklch(75% 0.16 55 / 0.12), 0 0 80px oklch(65% 0.18 280 / 0.06)'
          : data.theme === 'mono-brutal'
            ? '12px 12px 0px rgba(0,0,0,1)'
            : '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* ===== BACKGROUND LAYERS ===== */}

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
              opacity: data.theme === 'brand-light' ? 0.32 : data.theme === 'mono-brutal' ? 0.18 : 0.28,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: data.theme === 'brand-light'
                ? 'linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(251,251,253,0.88) 100%)'
                : data.theme === 'mono-brutal'
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.74) 0%, rgba(255,255,255,0.84) 100%)'
                  : 'linear-gradient(180deg, rgba(9,9,14,0.36) 0%, rgba(9,9,14,0.68) 100%)',
            }}
          />
        </>
      )}

      {data.theme === 'brand-dark' && (
        <>
          {/* Primary orb - top right */}
          <div style={{
            position: 'absolute', top: -80 * s, right: -40 * s,
            width: 320 * s, height: 320 * s,
            background: 'radial-gradient(circle, oklch(75% 0.16 55 / 0.15) 0%, oklch(75% 0.16 55 / 0.03) 50%, transparent 70%)',
            borderRadius: '50%', filter: `blur(${60 * s}px)`,
          }} />
          {/* Secondary orb - bottom left */}
          <div style={{
            position: 'absolute', bottom: -60 * s, left: -40 * s,
            width: 280 * s, height: 280 * s,
            background: 'radial-gradient(circle, oklch(65% 0.18 280 / 0.12) 0%, oklch(65% 0.18 280 / 0.02) 50%, transparent 70%)',
            borderRadius: '50%', filter: `blur(${50 * s}px)`,
          }} />
        </>
      )}

      {data.theme === 'brand-light' && (
        <>
          {/* Subtle gradient orb */}
          <div style={{
            position: 'absolute', top: -100 * s, right: -60 * s,
            width: 300 * s, height: 300 * s,
            background: 'radial-gradient(circle, rgba(0, 113, 227, 0.04) 0%, transparent 60%)',
            borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute', bottom: -80 * s, left: -40 * s,
            width: 250 * s, height: 250 * s,
            background: 'radial-gradient(circle, rgba(41, 151, 255, 0.03) 0%, transparent 60%)',
            borderRadius: '50%',
          }} />
        </>
      )}

      {/* ===== CONTENT ===== */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        height: '100%',
        padding: data.theme === 'terminal-green'
          ? `${44 * s}px ${36 * s}px ${28 * s}px`
          : `${32 * s}px ${36 * s}px ${28 * s}px`,
      }}>

        {/* == HEADER == */}
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 * s }}>
            {/* Avatar with ring */}
            <div style={{
              width: 58 * s, height: 58 * s,
              borderRadius: data.theme === 'mono-brutal' ? 4 * s : '50%',
              padding: 3 * s,
              transition: 'all 0.4s ease',
              background: data.theme === 'mono-brutal'
                ? '#000000'
                : `linear-gradient(135deg, ${tc.accent}, ${tc.accent2})`,
              flexShrink: 0,
              boxShadow: data.theme === 'mono-brutal'
                ? '4px 4px 0px rgba(0,0,0,0.1)'
                : 'none',
            }}>
              <div style={{
                width: '100%', height: '100%',
                borderRadius: data.theme === 'mono-brutal' ? 2 * s : '50%',
                background: data.theme === 'mono-brutal' ? '#fff' : data.theme === 'brand-dark' || data.theme === 'terminal-green' || data.theme === 'cyberpunk-neon' || data.theme === 'ocean-blue' || data.theme === 'sunset-warm' ? '#12101f' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26 * s,
                overflow: 'hidden',
              }}>
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
                    <span style={{ 
                      fontSize: 18 * s, 
                      color: tc.textDim,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}>
                      ⏳
                    </span>
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

            {/* Name block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 * s }}>
                <span style={{
                  fontSize: 20 * s, fontWeight: 800, letterSpacing: '-0.03em',
                  color: tc.text,
                }}>
                  {data.theme === 'terminal-green' ? '$ ' : ''}{data.username || 'anonymous'}
                </span>
                {/* Title badge inline */}
                <span style={{
                  fontSize: 10 * s, fontWeight: 700,
                  padding: `${2 * s}px ${7 * s}px`,
                  borderRadius: data.theme === 'mono-brutal' ? 0 : 10 * s,
                  background: `${title.color}18`,
                  color: title.color,
                  border: `1px solid ${title.color}30`,
                  whiteSpace: 'nowrap',
                }}>
                  {title.icon} {isZh ? title.title : title.titleEn}
                </span>
              </div>
              <div style={{
                fontSize: 11 * s, color: tc.textDim,
                marginTop: 5 * s,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontStyle: data.theme === 'terminal-green' ? 'normal' : 'italic',
                letterSpacing: '0.01em',
              }}>
                {data.theme === 'mono-brutal' ? '' : '"'}{data.slogan || 'Build with AI'}{data.theme === 'mono-brutal' ? '' : '"'}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div style={{
            height: 1.5,
            background: tc.divider,
            marginTop: 18 * s,
          }} />
        </div>

        {/* == MAIN BODY == */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 * s, padding: `${10 * s}px 0` }}>

          {/* Section label */}
          <div style={{
            fontSize: 10 * s, fontWeight: 700, color: tc.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.15em',
          }}>
            {isZh ? '本月 AI 消耗' : 'MONTHLY AI USAGE'}
            <span style={{ float: 'right', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'none' }}>
              {dateStr}
            </span>
          </div>

          {/* Giant token number */}
          <div style={{
            background: tc.panelBg,
            border: `1px solid ${tc.panelBorder}`,
            borderRadius: data.theme === 'mono-brutal' ? 0 : 14 * s,
            padding: `${18 * s}px ${22 * s}px ${14 * s}px`,
            transition: 'all 0.4s ease',
          }}>
            <div style={{
              fontSize: 44 * s, fontWeight: 900, lineHeight: 1,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
              color: tc.text,
              transition: 'all 0.4s ease',
              textShadow: data.theme === 'brand-dark'
                ? `0 0 30px oklch(75% 0.16 55 / 0.5), 0 0 60px oklch(65% 0.18 280 / 0.2)`
                : 'none',
            }}>
              {tokenDisplay}
              <span style={{
                fontSize: 14 * s, fontWeight: 600, color: tc.textDim,
                marginLeft: 6 * s, letterSpacing: '0.02em',
              }}>tokens</span>
            </div>

            {/* Metaphor */}
            <div style={{
              marginTop: 12 * s,
              display: 'flex', alignItems: 'flex-start', gap: 4 * s,
            }}>
              <span style={{
                fontSize: 20 * s, lineHeight: 1, color: `${tc.accent}30`,
                fontFamily: 'Georgia, "Times New Roman", serif',
                marginTop: -2 * s,
              }}>"</span>
              <span style={{
                fontSize: 13 * s, fontWeight: 500, lineHeight: 1.5,
                color: tc.textSecondary,
              }}>
                {metaphor}
              </span>
            </div>
          </div>

          {/* 3 Stats */}
          <div style={{ display: 'flex', gap: 8 * s }}>
            {[
              { label: isZh ? '预估花费' : 'Est. Cost', value: estimatedCost > 0 ? `$${estimatedCost.toLocaleString()}` : '$0', icon: '💰' },
              { label: isZh ? '活跃天数' : 'Active', value: '30d', icon: '📅' },
              { label: isZh ? '主力渠道' : 'Channel', value: channelInfo.label.split(' ')[0], icon: CHANNEL_ICONS[data.channel] || '⚪' },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center',
                background: tc.panelBg,
                border: `1px solid ${tc.panelBorder}`,
                borderRadius: data.theme === 'mono-brutal' ? 0 : 10 * s,
                padding: `${10 * s}px ${6 * s}px`,
                transition: 'all 0.4s ease',
              }}>
                <div style={{ fontSize: 14 * s, marginBottom: 3 * s }}>{stat.icon}</div>
                <div style={{ fontSize: 14 * s, fontWeight: 800, color: tc.text, lineHeight: 1.2 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 9 * s, fontWeight: 500, color: tc.textMuted, marginTop: 2 * s, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Model breakdown */}
          {data.modelBreakdown.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * s }}>
              {data.modelBreakdown.map((model, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 * s }}>
                  <span style={{
                    fontSize: 11 * s, fontWeight: 600, width: 60 * s,
                    color: tc.textDim,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {model.name}
                  </span>
                  <div style={{
                    flex: 1, height: 10 * s,
                    background: tc.barTrack,
                    borderRadius: data.theme === 'mono-brutal' ? 0 : 5 * s,
                    overflow: 'hidden',
                    transition: 'background 0.4s ease',
                  }}>
                    <div style={{
                      width: `${model.percentage}%`,
                      height: '100%',
                      transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease, box-shadow 0.4s ease',
                      borderRadius: data.theme === 'mono-brutal' ? 0 : 5 * s,
                      background: data.theme === 'mono-brutal'
                        ? '#000000'
                        : `linear-gradient(90deg, ${model.color}, ${model.color}cc)`,
                      boxShadow: data.theme === 'brand-dark'
                        ? `0 0 8px ${model.color}40, 0 2px 4px ${model.color}20`
                        : 'none',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 11 * s, fontWeight: 700, width: 36 * s, textAlign: 'right',
                    color: model.color,
                  }}>
                    {model.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Style tags */}
          <div style={{ display: 'flex', gap: 6 * s, flexWrap: 'wrap' }}>
            {tags.map((tag, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4 * s,
                padding: `${4 * s}px ${10 * s}px`,
                borderRadius: data.theme === 'mono-brutal' ? 0 : 20 * s,
                fontSize: 11 * s, fontWeight: 500,
                color: tc.textDim,
                background: tc.panelBg,
                border: `1px solid ${tc.panelBorder}`,
              }}>
                {tag.icon} {isZh ? tag.label : tag.labelEn}
              </span>
            ))}
          </div>
        </div>

        {/* == FOOTER == */}
        <div>
          {/* Footer divider */}
          <div style={{
            height: 1,
            background: tc.divider,
            marginBottom: 14 * s,
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {/* Left: branding */}
            <div>
              <div style={{
                fontSize: 16 * s, fontWeight: 900, letterSpacing: '-0.03em',
                color: tc.text,
                display: 'flex', alignItems: 'center', gap: 6 * s,
              }}>
                {/* Mini logo mark */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 20 * s, height: 20 * s,
                  borderRadius: data.theme === 'mono-brutal' ? 2 * s : 5 * s,
                  background: data.theme === 'mono-brutal'
                    ? '#000000'
                    : `linear-gradient(135deg, ${tc.accent}, ${tc.accent2})`,
                  fontSize: 11 * s, fontWeight: 900, color: '#fff',
                }}>T</span>
                tokcard.dev
              </div>
              <div style={{
                fontSize: 10 * s, color: tc.textMuted, marginTop: 3 * s,
                letterSpacing: '0.03em',
              }}>
                #TokCard &middot; {isZh ? '用 AI 烧到这份上了' : 'Built to flex your AI grind'}
              </div>
              <div style={{
                fontSize: 9 * s, color: tc.textMuted, marginTop: 4 * s,
                letterSpacing: '0.02em',
              }}>
                {isZh ? '别人晒腹肌，你晒 token · tokcard.dev' : 'Others flex abs, you flex tokens · tokcard.dev'}
              </div>
            </div>

            {/* Right: QR code */}
            {qrDataUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 76 * s, height: 76 * s,
                  borderRadius: data.theme === 'mono-brutal' ? 0 : 10 * s,
                  overflow: 'hidden',
                  background: qrColors.light,
                  padding: 4 * s,
                  boxShadow: data.theme === 'brand-dark'
                    ? `0 0 16px oklch(75% 0.16 55 / 0.2), 0 2px 8px rgba(0,0,0,0.2)`
                    : data.theme === 'mono-brutal'
                      ? '4px 4px 0px rgba(0,0,0,1)'
                      : '0 1px 4px rgba(0,0,0,0.06)',
                  border: data.theme === 'minimal-gray' ? '1px solid #e5e7eb' : 'none',
                }}>
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'auto' }}
                  />
                </div>
                <div style={{
                  fontSize: 8 * s, color: tc.textMuted, marginTop: 4 * s,
                  textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {isZh ? '扫码看我的 AI 战绩' : 'Scan to view my AI card'}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
