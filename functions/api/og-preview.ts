import type { Handler } from '@cloudflare/workers-types';
import { decodeSharedCardPayload, formatTokens } from '@/lib/card';
import { getRankTier } from '@/lib/titles';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const onRequest: Handler = async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const encoded = searchParams.get('d');
  const shared = encoded ? decodeSharedCardPayload(encoded) : null;

  const username = shared?.card.username || 'tokcard.dev';
  const tokens = shared ? formatTokens(shared.card.totalTokens) : '2.3B';
  const tier = shared ? getRankTier(shared.card.totalTokens) : getRankTier(2_300_000_000);
  const slogan = shared?.card.slogan || '做一张能晒的 AI 战绩卡';

  const svg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <text x="112" y="250" fill="#FFFFFF" font-size="76" font-weight="700" font-family="Arial, sans-serif">${escapeXml(tokens)} tokens</text>
    <text x="112" y="320" fill="url(#accent)" font-size="34" font-weight="700" font-family="Arial, sans-serif">${escapeXml(tier.badge)} ${escapeXml(tier.clubLabelEn)}</text>
    <text x="112" y="392" fill="#E2E8F0" font-size="42" font-weight="600" font-family="Arial, sans-serif">@${escapeXml(username)}</text>
    <text x="112" y="450" fill="#94A3B8" font-size="28" font-family="Arial, sans-serif">${escapeXml(slogan)}</text>
    <text x="112" y="520" fill="#60A5FA" font-size="24" font-family="Arial, sans-serif">Make your token flex card at tokcard.dev</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
