import type { Handler } from '@cloudflare/workers-types';

const CARD_KEY_PREFIX = 'tokcard:card:';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function getRankBadge(tokens: number): string {
  if (tokens >= 100_000_000_000) return '🌌 Singularity';
  if (tokens >= 10_000_000_000) return '🚀 Ultra';
  if (tokens >= 1_000_000_000) return '👑 Mythic';
  if (tokens >= 100_000_000) return '🏆 Legend';
  if (tokens >= 10_000_000) return '🏅 Expert';
  if (tokens >= 1_000_000) return '⚡ Apprentice';
  return '🪄 Starter';
}

function normalizeCardId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9]{4,16}$/.test(normalized) ? normalized : '';
}

interface StoredCard {
  u?: string;
  s?: string;
  t?: number;
  [key: string]: unknown;
}

export const onRequest: Handler = async (context) => {
  const url = new URL(context.request.url);
  const id = normalizeCardId(url.searchParams.get('id') || '');

  const namespace = context.env?.TOKCARD_METRICS as KVNamespace | undefined;

  let card: StoredCard | null = null;

  if (id && namespace) {
    const raw = await namespace.get(`${CARD_KEY_PREFIX}${id}`);
    if (raw) {
      try {
        card = JSON.parse(raw) as StoredCard;
      } catch {
        card = null;
      }
    }
  }

  // Also support legacy ?d= base64 param by decoding inline
  if (!card) {
    const encoded = url.searchParams.get('d');
    if (encoded) {
      try {
        const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const normalized = padded + '='.repeat((4 - (padded.length % 4)) % 4);
        const json = atob(normalized);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          card = parsed as StoredCard;
        }
      } catch {
        card = null;
      }
    }
  }

  const username = escapeXml(String(card?.u || 'tokcard.dev'));
  const tokens = formatTokens(Number(card?.t || 2_300_000_000));
  const rank = getRankBadge(Number(card?.t || 2_300_000_000));
  const slogan = escapeXml(String(card?.s || '做一张能晒的 AI 战绩卡'));

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0F172A"/>
      <stop offset="1" stop-color="#312E81"/>
    </linearGradient>
    <linearGradient id="accent" x1="220" y1="180" x2="820" y2="420" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F59E0B"/>
      <stop offset="1" stop-color="#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="40" fill="url(#bg)"/>
  <rect x="72" y="72" width="1056" height="486" rx="32" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>
  <text x="112" y="150" fill="#CBD5E1" font-size="28" font-family="Arial, sans-serif">TokCard · AI Social Card</text>
  <text x="112" y="250" fill="#FFFFFF" font-size="76" font-weight="700" font-family="Arial, sans-serif">${tokens} tokens</text>
  <text x="112" y="320" fill="url(#accent)" font-size="34" font-weight="700" font-family="Arial, sans-serif">${rank}</text>
  <text x="112" y="392" fill="#E2E8F0" font-size="42" font-weight="600" font-family="Arial, sans-serif">@${username}</text>
  <text x="112" y="450" fill="#94A3B8" font-size="28" font-family="Arial, sans-serif">${slogan}</text>
  <text x="112" y="520" fill="#60A5FA" font-size="24" font-family="Arial, sans-serif">Make your token flex card at tokcard.dev</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
