const DEFAULT_ALLOWED_ORIGIN = 'https://tokcard.dev';

export const ALLOWED_ORIGINS = new Set([
  'https://tokcard.dev',
  'https://www.tokcard.dev',
  'https://tokcard.pages.dev',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
]);

export function buildCorsHeaders(origin?: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ALLOWED_ORIGIN;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

export function jsonResponse(body: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(origin),
    },
  });
}

export function validateOrigin(origin: string | null): Response | null {
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
  }
  return null;
}

export function handleOptions(origin: string | null): Response {
  return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
}
