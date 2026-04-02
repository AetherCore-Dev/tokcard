import type { Handler } from '@cloudflare/workers-types';
import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { checkRateLimit } from '../lib/rate-limit';

const CARD_KEY_PREFIX = 'tokcard:card:';
const CARD_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year
const MAX_PAYLOAD_SIZE = 10_000;
const ID_LENGTH = 8;
const MAX_STRING_LENGTH = 200;
const MAX_MODEL_ENTRIES = 5;
const MAX_PROJECT_ENTRIES = 3;

function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(bytes)
    .map((byte) => chars[byte % chars.length])
    .join('');
}

function getCardKey(id: string): string {
  return `${CARD_KEY_PREFIX}${id}`;
}

function normalizeCardId(value?: string): string {
  const normalized = (value || '').trim().toLowerCase();
  return /^[a-z0-9]{4,16}$/.test(normalized) ? normalized : '';
}

function getNamespace(context: Parameters<Handler>[0]): KVNamespace | undefined {
  return context.env?.TOKCARD_METRICS as KVNamespace | undefined;
}

function safeString(value: unknown, maxLen = MAX_STRING_LENGTH): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

function safeNumber(value: unknown, min = 0, max = 1_000_000_000_000): number {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return 0;
  return Math.max(min, Math.min(max, num));
}

interface RawModelBreakdown {
  name?: unknown;
  percentage?: unknown;
  color?: unknown;
}

interface RawProject {
  id?: unknown;
  name?: unknown;
  icon?: unknown;
  url?: unknown;
  displayType?: unknown;
}

/**
 * Extract only known, safe fields from the raw request body.
 * Prevents arbitrary field injection into KV storage.
 */
function buildSafeCardPayload(raw: Record<string, unknown>, id: string): string {
  const modelBreakdown = Array.isArray(raw.mb)
    ? (raw.mb as RawModelBreakdown[]).slice(0, MAX_MODEL_ENTRIES).map((m) => ({
        name: safeString(m?.name, 32),
        percentage: safeNumber(m?.percentage, 0, 100),
        color: /^#[0-9a-fA-F]{3,8}$/.test(String(m?.color ?? '')) ? String(m.color) : '#6b7280',
      }))
    : [];

  const projects = Array.isArray(raw.pr)
    ? (raw.pr as RawProject[]).slice(0, MAX_PROJECT_ENTRIES).map((p, i) => ({
        id: safeString(p?.id, 32) || `project-${i + 1}`,
        name: safeString(p?.name, 28),
        icon: safeString(p?.icon, 4) || '✨',
        url: safeString(p?.url, 256),
        displayType: p?.displayType === 'icon' ? 'icon' : 'icon+text',
      }))
    : [];

  return JSON.stringify({
    _id: id,
    _createdAt: new Date().toISOString(),
    v: 1,
    u: safeString(raw.u, 64),
    at: safeString(raw.at, 16),
    av: safeString(raw.av, 256),
    s: safeString(raw.s),
    m: safeString(raw.m),
    t: safeNumber(raw.t),
    lt: safeNumber(raw.lt),
    c: safeString(raw.c, 16),
    th: safeString(raw.th, 32),
    bgT: safeString(raw.bgT, 16),
    bgV: safeString(raw.bgV, 256),
    mb: modelBreakdown,
    mc: safeString(raw.mc, 16),
    l: safeString(raw.l, 4),
    p: safeString(raw.p, 16),
    link: safeString(raw.link, 512),
    pr: projects,
    ref: safeString(raw.ref, 32),
    tr: safeString(raw.tr, 32),
    ps: safeString(raw.ps, 16),
    pds: safeString(raw.pds, 24),
    pde: safeString(raw.pde, 24),
    iat: safeString(raw.iat, 24),
  });
}

export const onRequest: Handler = async (context) => {
  const requestOrigin = context.request.headers.get('Origin');

  const originError = validateOrigin(requestOrigin);
  if (originError) return originError;

  if (context.request.method === 'OPTIONS') {
    return handleOptions(requestOrigin);
  }

  const namespace = getNamespace(context);
  if (!namespace) {
    return jsonResponse({ error: 'Storage unavailable' }, 503, requestOrigin);
  }

  // Rate limiting
  const ip = context.request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { allowed } = await checkRateLimit(namespace, ip, 'rate:cards');
  if (!allowed) {
    return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429, requestOrigin);
  }

  // GET /api/cards?id=abc123 — retrieve card data
  if (context.request.method === 'GET') {
    const url = new URL(context.request.url);
    const id = normalizeCardId(url.searchParams.get('id') || '');

    if (!id) {
      return jsonResponse({ error: 'Card ID is required' }, 400, requestOrigin);
    }

    const raw = await namespace.get(getCardKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Card not found' }, 404, requestOrigin);
    }

    return new Response(raw, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(requestOrigin),
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  // POST /api/cards — store card data, return short ID
  if (context.request.method === 'POST') {
    try {
      const body = await context.request.text();

      if (!body || body.length > MAX_PAYLOAD_SIZE) {
        return jsonResponse(
          { error: body ? 'Payload too large' : 'Empty payload' },
          body ? 413 : 400,
          requestOrigin
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, requestOrigin);
      }

      if (typeof parsed !== 'object' || parsed === null) {
        return jsonResponse({ error: 'Invalid card data' }, 400, requestOrigin);
      }

      const id = generateShortId();
      const storedData = buildSafeCardPayload(parsed as Record<string, unknown>, id);

      await namespace.put(getCardKey(id), storedData, {
        expirationTtl: CARD_TTL_SECONDS,
      });

      return jsonResponse({ id, url: `/u/${id}` }, 201, requestOrigin);
    } catch (error) {
      console.error('cards POST error', error);
      return jsonResponse({ error: 'Failed to store card' }, 500, requestOrigin);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin);
};
