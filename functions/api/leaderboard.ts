import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { readFilteredLeaderboard } from '../lib/leaderboard';

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function normalizeCardId(value?: string): string {
  const normalized = (value || '').trim().toLowerCase();
  return /^[a-z0-9]{4,16}$/.test(normalized) ? normalized : '';
}

export const onRequest = async (context: any) => {
  const requestOrigin = context.request.headers.get('Origin');

  const originError = validateOrigin(requestOrigin);
  if (originError) return originError;

  if (context.request.method === 'OPTIONS') {
    return handleOptions(requestOrigin);
  }

  if (context.request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin);
  }

  const kv = context.env?.TOKCARD_METRICS as KVNamespace | undefined;
  if (!kv) {
    return jsonResponse({ error: 'Storage unavailable' }, 503, requestOrigin);
  }

  try {
    const url = new URL(context.request.url);
    const region = url.searchParams.get('region') || undefined;
    const company = url.searchParams.get('company') || undefined;
    const time = url.searchParams.get('time') || undefined;
    const channel = url.searchParams.get('channel') || undefined;
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 50);
    const requestedPage = parsePositiveInt(url.searchParams.get('page'), 1, 9999);
    const focus = normalizeCardId(url.searchParams.get('focus') || '');

    const filtered = await readFilteredLeaderboard(kv, {
      region,
      company,
      time: time === 'week' || time === 'month' || time === 'all' ? time : 'all',
      channel,
    });

    const companySuggestions = Array.from(
      new Set(filtered.entries.map((entry) => entry.company).filter(Boolean) as string[])
    ).slice(0, 12);

    const topCompanies = [...filtered.entries.reduce((map, entry) => {
      if (!entry.company) return map;
      map.set(entry.company, (map.get(entry.company) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    let offset = (requestedPage - 1) * limit;
    if (!url.searchParams.get('page') && focus) {
      const focusIndex = filtered.entries.findIndex((entry) => entry.id === focus);
      if (focusIndex >= 0) {
        offset = Math.floor(focusIndex / limit) * limit;
      }
    }
    if (filtered.total > 0 && offset >= filtered.total) {
      offset = Math.floor((filtered.total - 1) / limit) * limit;
    }

    const entries = filtered.entries.slice(offset, offset + limit);
    const page = Math.floor(offset / limit) + 1;
    const responsePayload = {
      version: filtered.version,
      updatedAt: filtered.updatedAt,
      total: filtered.total,
      entries,
      meta: {
        offset,
        limit,
        page,
        hasMore: offset + entries.length < filtered.total,
        companySuggestions,
        topCompanies,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(requestOrigin),
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('leaderboard GET error', error);
    return jsonResponse({ error: 'Failed to load leaderboard' }, 500, requestOrigin);
  }
};
