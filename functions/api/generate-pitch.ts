import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { checkRateLimit } from '../lib/rate-limit';
import { callDeepSeek, formatTokenValue, sanitizeForPrompt } from '../lib/deepseek';

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }

  return '';
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized === '::1' || normalized.endsWith('.local')) return true;
  if (/^127\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^169\.254\./.test(normalized)) return true;

  const match172 = normalized.match(/^172\.(\d+)\./);
  if (match172) {
    const second = Number(match172[1]);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

async function fetchProjectContext(projectUrl: string): Promise<{ title: string; description: string }> {
  try {
    const url = new URL(projectUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { title: '', description: '' };
    }
    if (isBlockedHostname(url.hostname)) {
      return { title: '', description: '' };
    }

    const response = await fetch(url.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'TokCardBot/1.0 (+https://tokcard.dev)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/html')) {
      return { title: '', description: '' };
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = sanitizeForPrompt(stripHtml(titleMatch?.[1] ?? ''), 120);
    const description = sanitizeForPrompt(
      extractMeta(html, 'description') || extractMeta(html, 'og:description'),
      220,
    );

    return { title, description };
  } catch {
    return { title: '', description: '' };
  }
}

export const onRequest: PagesFunction = async (context) => {
  const requestOrigin = context.request.headers.get('Origin');

  const originError = validateOrigin(requestOrigin);
  if (originError) return originError;

  if (context.request.method === 'OPTIONS') {
    return handleOptions(requestOrigin);
  }

  if (context.request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin);
  }

  const namespace = (context.env as { TOKCARD_METRICS?: KVNamespace }).TOKCARD_METRICS;
  if (namespace) {
    const ip = context.request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { allowed } = await checkRateLimit(namespace, ip, 'rate:pitch');
    if (!allowed) {
      return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429, requestOrigin);
    }
  }

  try {
    const body = await context.request.json() as Record<string, unknown>;
    const projectName = sanitizeForPrompt(String(body.projectName ?? ''), 64);
    const projectUrl = String(body.projectUrl ?? '').trim();
    const tokens = Math.max(0, Number(body.tokens ?? 0));
    const locale = body.locale === 'en' ? 'en' : 'zh';

    if (!projectName) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = (context.env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);
    const projectContext = projectUrl ? await fetchProjectContext(projectUrl) : { title: '', description: '' };

    const prompt = locale === 'zh'
      ? `你是一个顶级产品增长文案专家。请为一个 AI 项目生成 3 条一句话介绍，用在 TokCard 卡片和排行榜上。

项目名：${projectName}
${projectUrl ? `项目链接：${projectUrl}` : ''}
${projectContext.title ? `网页标题：${projectContext.title}` : ''}
${projectContext.description ? `网页描述：${projectContext.description}` : ''}
${tokens > 0 ? `用户 token 用量：${tokenDesc}` : ''}

要求：
- 只输出 3 条候选文案，每行 1 条
- 每条不超过 24 个字
- 必须具体、有力度、有吸引力
- 优先强调速度、结果、规模、用户价值或野心
- 至少 1 条偏“牛逼型”，适合让人想点开
- 不要空话，不要“帮助用户更好地”这种套话
- 不要解释，不要编号

只输出文案本身。`
      : `You are an elite product copywriter. Generate 3 one-line pitches for an AI project to be shown on TokCard cards and the leaderboard.

Project name: ${projectName}
${projectUrl ? `Project URL: ${projectUrl}` : ''}
${projectContext.title ? `Page title: ${projectContext.title}` : ''}
${projectContext.description ? `Page description: ${projectContext.description}` : ''}
${tokens > 0 ? `Token usage: ${tokenDesc}` : ''}

Requirements:
- Output exactly 3 candidates, one per line
- Each line must be 12 words or fewer
- Be specific, sharp, and high-signal
- Emphasize speed, outcomes, scale, user value, or ambition
- At least 1 line should feel bold enough to make people click
- Avoid generic filler like "help users better"
- No numbering or explanation

Output only the lines.`;

    const content = await callDeepSeek(apiKey as string, prompt, 180, 0.8);

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(requestOrigin) },
    });
  } catch (error) {
    console.error('generate-pitch error:', error);
    const message = error instanceof Error && error.message === 'AI service temporarily unavailable'
      ? error.message
      : 'Internal server error';
    return jsonResponse({ error: message }, 500, requestOrigin);
  }
};
