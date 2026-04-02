import type { Handler } from '@cloudflare/workers-types';

const CARD_KEY_PREFIX = 'tokcard:card:';

interface StoredCard {
  _id: string;
  u?: string;    // username
  s?: string;    // slogan
  t?: number;    // totalTokens
  c?: string;    // channel
  th?: string;   // theme
  [key: string]: unknown;
}

function normalizeCardId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9]{4,16}$/.test(normalized) ? normalized : '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
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

function isCrawler(userAgent: string): boolean {
  const crawlerPatterns = [
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'slackbot',
    'telegrambot',
    'whatsapp',
    'discordbot',
    'googlebot',
    'bingbot',
    'baiduspider',
    'bytespider',
    'wechat',
    'micromessenger',
    'line/',
  ];
  const ua = userAgent.toLowerCase();
  return crawlerPatterns.some((pattern) => ua.includes(pattern));
}

function injectOgMeta(html: string, card: StoredCard, cardId: string, requestUrl: string): string {
  const username = escapeHtml(String(card.u || 'TokCard User'));
  const tokens = formatTokens(Number(card.t || 0));
  const slogan = escapeHtml(String(card.s || 'AI builder card'));
  const rank = getRankBadge(Number(card.t || 0));

  const ogTitle = `${username} 的 AI 战绩卡 · ${tokens} tokens`;
  const ogDescription = `${rank} · ${slogan} — 查看 ${username} 的 AI 使用战绩，也生成你的同款卡片。`;
  const origin = new URL(requestUrl).origin;
  const ogImage = `${origin}/api/og-image?id=${cardId}`;
  const ogUrl = `${origin}/u/${cardId}`;

  const metaTags = `
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="TokCard" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDescription}" />
    <meta name="twitter:image" content="${ogImage}" />`;

  // Replace existing OG tags in the HTML
  let result = html.replace(/<meta property="og:[^"]*" content="[^"]*"\s*\/?>/g, '');
  result = result.replace(/<meta name="twitter:[^"]*" content="[^"]*"\s*\/?>/g, '');

  // Inject new meta tags before </head>
  result = result.replace('</head>', `${metaTags}\n  </head>`);

  // Update <title> and description
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${ogTitle}</title>`);
  result = result.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${ogDescription}" />`
  );

  return result;
}

/**
 * Fetch the base /u/index.html static asset.
 * Uses ASSETS binding (Cloudflare Pages) to get the static HTML for the /u page,
 * since /u/abc123 has no static file — only /u/index.html exists.
 */
async function fetchBaseHtml(context: Parameters<Handler>[0]): Promise<string> {
  const assets = (context.env as Record<string, unknown>).ASSETS as { fetch: typeof fetch } | undefined;
  if (assets) {
    const origin = new URL(context.request.url).origin;
    const response = await assets.fetch(new Request(`${origin}/u/`));
    if (response.ok) {
      return response.text();
    }
  }

  // Fallback: try context.next() for /u/ base path
  try {
    const fallbackUrl = new URL(context.request.url);
    fallbackUrl.pathname = '/u/';
    const response = await context.next();
    if (response.ok) {
      return response.text();
    }
  } catch {
    // ignore
  }

  // Minimal fallback HTML
  return `<!doctype html><html><head><title>TokCard</title></head><body><script>window.location.href='/u';</script></body></html>`;
}

export const onRequest: Handler = async (context) => {
  const url = new URL(context.request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);

  // Extract card ID from /u/abc123
  const cardId = pathParts.length >= 2 ? normalizeCardId(pathParts[1]) : '';

  // Legacy support: /u?d=<base64> still works via client-side JS
  if (!cardId) {
    return context.next();
  }

  const namespace = context.env?.TOKCARD_METRICS as KVNamespace | undefined;
  if (!namespace) {
    return context.next();
  }

  // Load card from KV
  const raw = await namespace.get(`${CARD_KEY_PREFIX}${cardId}`);
  if (!raw) {
    // Card not found — redirect to /u/ which shows the "invalid" state
    return context.next();
  }

  let card: StoredCard;
  try {
    card = JSON.parse(raw) as StoredCard;
  } catch {
    return context.next();
  }

  // Fetch the base /u/index.html static page
  const html = await fetchBaseHtml(context);
  const userAgent = context.request.headers.get('User-Agent') || '';

  if (isCrawler(userAgent)) {
    // For crawlers: inject OG meta only
    const modifiedHtml = injectOgMeta(html, card, cardId, context.request.url);
    return new Response(modifiedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  // For browsers: inject OG meta + card data as JS global
  let modifiedHtml = injectOgMeta(html, card, cardId, context.request.url);
  const cardScript = `<script>window.__TOKCARD_DATA__=${JSON.stringify(card).replace(/</g, '\\u003c')};</script>`;
  modifiedHtml = modifiedHtml.replace('</head>', `${cardScript}\n  </head>`);

  return new Response(modifiedHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
};
