export type ShareMetricEvent = 'share:view' | 'share:click_destination' | 'share:clone';

export interface ShareMetrics {
  views: number;
  clicks: number;
  clones: number;
  lastUpdatedAt?: string;
}

interface TrackMetricInput {
  event: ShareMetricEvent;
  metricsId: string;
  payload: string;
  metadata?: {
    trustTier?: string;
    username?: string;
    platform?: string;
  };
}

interface TrackMetricResponse {
  available?: boolean;
  currentStats?: ShareMetrics;
}

function fallbackHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(12, '0').slice(0, 12);
}

async function sha256Hex(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return fallbackHash(value);
}

export async function getMetricsIdFromPayload(payload: string): Promise<string> {
  const hash = await sha256Hex(payload.trim());
  return hash.slice(0, 12);
}

function normalizeMetrics(raw?: Partial<ShareMetrics> | null): ShareMetrics {
  return {
    views: Number(raw?.views ?? 0),
    clicks: Number(raw?.clicks ?? 0),
    clones: Number(raw?.clones ?? 0),
    lastUpdatedAt: raw?.lastUpdatedAt,
  };
}

export async function trackShareMetric({ event, metricsId, payload, metadata }: TrackMetricInput): Promise<ShareMetrics | null> {
  if (!metricsId || !payload.trim()) {
    return null;
  }

  try {
    const response = await fetch('/api/track-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      keepalive: true,
      body: JSON.stringify({
        event,
        metricsId,
        payload,
        metadata,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as TrackMetricResponse;
    if (result.available === false) {
      return null;
    }

    return normalizeMetrics(result.currentStats);
  } catch {
    return null;
  }
}

export async function fetchShareMetrics(metricsId: string): Promise<ShareMetrics | null> {
  if (!metricsId) {
    return null;
  }

  try {
    const response = await fetch(`/api/track-event?metricsId=${encodeURIComponent(metricsId)}`);
    if (!response.ok) {
      return null;
    }

    const result = await response.json() as TrackMetricResponse;
    if (result.available === false) {
      return null;
    }

    return normalizeMetrics(result.currentStats);
  } catch {
    return null;
  }
}
