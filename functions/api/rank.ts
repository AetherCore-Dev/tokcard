import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { getRankSummary } from '../lib/leaderboard';

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
    const id = normalizeCardId(url.searchParams.get('id') || '');
    if (!id) {
      return jsonResponse({ error: 'Card ID is required' }, 400, requestOrigin);
    }

    const rank = await getRankSummary(kv, id);
    if (!rank) {
      return jsonResponse({ error: 'Rank not found' }, 404, requestOrigin);
    }

    return new Response(JSON.stringify(rank), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(requestOrigin),
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('rank GET error', error);
    return jsonResponse({ error: 'Failed to load rank' }, 500, requestOrigin);
  }
};
