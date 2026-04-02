import type { Handler } from '@cloudflare/workers-types';
import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { checkRateLimit } from '../lib/rate-limit';

type ShareMetricEvent = 'share:view' | 'share:click_destination' | 'share:clone';
type TrustTier = 'self-reported' | 'screenshot-backed' | 'usage-imported' | 'strong-authenticated';
type PlatformKey = 'wechat' | 'twitter' | 'instagram' | 'weibo' | 'xiaohongshu' | 'linkedin';

interface MetricsRecord {
  metricsId: string;
  views: number;
  clicks: number;
  clones: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
  trustTier?: TrustTier;
  username?: string;
  platform?: PlatformKey;
  payloadSize?: number;
}

interface EventRequestBody {
  event?: ShareMetricEvent;
  metricsId?: string;
  payload?: string;
  metadata?: {
    trustTier?: string;
    username?: string;
    platform?: string;
  };
}

const TTL_SECONDS = 60 * 60 * 24 * 90;
const MAX_PAYLOAD_SIZE = 10_000;
const METRIC_KEY_PREFIX = 'tokcard:metrics:';
const VALID_EVENTS: ShareMetricEvent[] = ['share:view', 'share:click_destination', 'share:clone'];
const VALID_TRUST_TIERS = new Set<TrustTier>(['self-reported', 'screenshot-backed', 'usage-imported', 'strong-authenticated']);
const VALID_PLATFORMS = new Set<PlatformKey>(['wechat', 'twitter', 'instagram', 'weibo', 'xiaohongshu', 'linkedin']);

function getMetricKey(metricsId: string) {
  return `${METRIC_KEY_PREFIX}${metricsId}`;
}

function normalizeMetricsId(value?: string) {
  const normalized = (value || '').trim().toLowerCase();
  return /^[a-f0-9]{12,64}$/.test(normalized) ? normalized : '';
}

function emptyStats() {
  return {
    views: 0,
    clicks: 0,
    clones: 0,
  };
}

function applyEvent(record: MetricsRecord, event: ShareMetricEvent): MetricsRecord {
  return {
    ...record,
    views: event === 'share:view' ? record.views + 1 : record.views,
    clicks: event === 'share:click_destination' ? record.clicks + 1 : record.clicks,
    clones: event === 'share:clone' ? record.clones + 1 : record.clones,
  };
}

function getNamespace(context: Parameters<Handler>[0]) {
  return context.env?.TOKCARD_METRICS as KVNamespace | undefined;
}

function sanitizeMetadata(metadata?: EventRequestBody['metadata']) {
  const trustTier = metadata?.trustTier && VALID_TRUST_TIERS.has(metadata.trustTier as TrustTier)
    ? metadata.trustTier as TrustTier
    : undefined;
  const platform = metadata?.platform && VALID_PLATFORMS.has(metadata.platform as PlatformKey)
    ? metadata.platform as PlatformKey
    : undefined;
  const username = typeof metadata?.username === 'string'
    ? metadata.username.trim().slice(0, 64)
    : undefined;

  return {
    trustTier,
    platform,
    username: username || undefined,
  };
}

async function readRecord(namespace: KVNamespace, metricsId: string): Promise<MetricsRecord | null> {
  const raw = await namespace.get(getMetricKey(metricsId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<MetricsRecord>;
    if (!parsed.metricsId) {
      return null;
    }

    return {
      metricsId,
      views: Number(parsed.views ?? 0),
      clicks: Number(parsed.clicks ?? 0),
      clones: Number(parsed.clones ?? 0),
      firstSeenAt: parsed.firstSeenAt || new Date().toISOString(),
      lastUpdatedAt: parsed.lastUpdatedAt || new Date().toISOString(),
      trustTier: parsed.trustTier,
      username: parsed.username,
      platform: parsed.platform,
      payloadSize: Number(parsed.payloadSize ?? 0),
    };
  } catch (error) {
    console.error('Failed to parse metrics record', { metricsId, error });
    return null;
  }
}

async function deriveMetricsId(payload: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 12);
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
    return jsonResponse({
      available: false,
      currentStats: emptyStats(),
    }, 200, requestOrigin);
  }

  // Rate limiting
  const ip = context.request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { allowed } = await checkRateLimit(namespace, ip, 'rate:track');
  if (!allowed) {
    return jsonResponse({ error: 'Rate limit exceeded' }, 429, requestOrigin);
  }

  if (context.request.method === 'GET') {
    const metricsId = normalizeMetricsId(new URL(context.request.url).searchParams.get('metricsId') || '');
    if (!metricsId) {
      return jsonResponse({ error: 'metricsId is required' }, 400, requestOrigin);
    }

    const existing = await readRecord(namespace, metricsId);
    return jsonResponse({
      available: true,
      currentStats: existing
        ? {
            views: existing.views,
            clicks: existing.clicks,
            clones: existing.clones,
            lastUpdatedAt: existing.lastUpdatedAt,
          }
        : emptyStats(),
    }, 200, requestOrigin);
  }

  if (context.request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin);
  }

  try {
    const body = await context.request.json() as EventRequestBody;
    const payload = body.payload?.trim() || '';
    const event = body.event;

    if (!payload || !event || !VALID_EVENTS.includes(event)) {
      return jsonResponse({ error: 'Missing or invalid event payload' }, 400, requestOrigin);
    }

    if (payload.length > MAX_PAYLOAD_SIZE) {
      return jsonResponse({ error: 'Payload too large' }, 413, requestOrigin);
    }

    const derivedMetricsId = await deriveMetricsId(payload);
    const requestedMetricsId = normalizeMetricsId(body.metricsId);
    if (requestedMetricsId && requestedMetricsId !== derivedMetricsId) {
      return jsonResponse({ error: 'metricsId does not match payload' }, 400, requestOrigin);
    }

    const metricsId = requestedMetricsId || derivedMetricsId;
    const metadata = sanitizeMetadata(body.metadata);
    const now = new Date().toISOString();
    const existing = await readRecord(namespace, metricsId);
    const base: MetricsRecord = existing ?? {
      metricsId,
      views: 0,
      clicks: 0,
      clones: 0,
      firstSeenAt: now,
      lastUpdatedAt: now,
      trustTier: metadata.trustTier,
      username: metadata.username,
      platform: metadata.platform,
      payloadSize: payload.length,
    };

    const nextRecord: MetricsRecord = {
      ...applyEvent(base, event),
      lastUpdatedAt: now,
      trustTier: metadata.trustTier || base.trustTier,
      username: metadata.username || base.username,
      platform: metadata.platform || base.platform,
      payloadSize: base.payloadSize || payload.length,
    };

    await namespace.put(getMetricKey(metricsId), JSON.stringify(nextRecord), {
      expirationTtl: TTL_SECONDS,
    });

    return jsonResponse({
      available: true,
      metricsId,
      currentStats: {
        views: nextRecord.views,
        clicks: nextRecord.clicks,
        clones: nextRecord.clones,
        lastUpdatedAt: nextRecord.lastUpdatedAt,
      },
    }, 200, requestOrigin);
  } catch (error) {
    console.error('track-event error', error);
    return jsonResponse({ error: 'Unable to process tracking event' }, 500, requestOrigin);
  }
};
