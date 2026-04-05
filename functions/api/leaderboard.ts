import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { readLeaderboard } from '../lib/leaderboard';

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
    const index = await readLeaderboard(kv);

    return new Response(JSON.stringify(index), {
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
