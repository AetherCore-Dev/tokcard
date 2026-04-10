import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { checkRateLimit } from '../lib/rate-limit';
import { callDeepSeek, formatTokenValue, sanitizeForPrompt } from '../lib/deepseek';

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
    const { allowed } = await checkRateLimit(namespace, ip, 'rate:caption');
    if (!allowed) {
      return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429, requestOrigin);
    }
  }

  try {
    const body = await context.request.json() as Record<string, unknown>;
    const platform = sanitizeForPrompt(String(body.platform ?? ''), 32);
    const tokens = Math.max(0, Number(body.tokens ?? 0));
    const metaphor = sanitizeForPrompt(String(body.metaphor ?? ''), 120);
    const username = sanitizeForPrompt(String(body.username ?? ''), 32);
    const locale = body.locale === 'en' ? 'en' : 'zh';
    const projects = Array.isArray(body.projects)
      ? body.projects.map((p: unknown) => sanitizeForPrompt(String(p ?? ''), 32)).filter(Boolean).slice(0, 3)
      : [];
    const slogan = sanitizeForPrompt(String(body.slogan ?? ''), 80);
    const trustTier = sanitizeForPrompt(String(body.trustTier ?? 'self-reported'), 32);
    const rankingSignalLabel = sanitizeForPrompt(String(body.rankingSignalLabel ?? ''), 64);
    const primaryProjectName = sanitizeForPrompt(String(body.primaryProjectName ?? ''), 64);
    const primaryProjectPitch = sanitizeForPrompt(String(body.primaryProjectPitch ?? ''), 140);

    if (!platform || tokens === 0) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = (context.env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);
    const projectText = [primaryProjectName, primaryProjectPitch, ...projects].filter(Boolean).join(' · ');
    const trustHint = locale === 'zh'
      ? (trustTier === 'self-reported' ? '不要伪装成官方认证榜单。' : '自然带出可信度，不要写成审计报告。')
      : (trustTier === 'self-reported' ? 'Do not sound like an official verified leaderboard claim.' : 'Carry credibility naturally without sounding like an audit report.');

    const prompt = locale === 'zh'
      ? `你是一个社交传播短文案专家。请输出 3 个适合 ${platform} 的短文案版本。

用户：${username || 'builder'}
Token：${tokenDesc}
项目：${projectText || '未填写'}
比喻：${metaphor || '无'}
签名：${slogan || '无'}
排名信号：${rankingSignalLabel || '未填写'}

要求：
- 输出 3 个版本：FLEX、HYPE、TECH
- 每个版本必须包含 TITLE / BODY / HASHTAGS / EMOJI / VIBE
- TITLE 不超过 10 个字
- BODY 只写 1-2 句短句，不要长段落
- HASHTAGS 最多 2 个
- TECH 版本最自然地体现可信 / 排名信号
- ${trustHint}
- 文案要短、准、可直接复制，不要废话

严格格式：
TITLE: ...
BODY: ...
HASHTAGS: ...
EMOJI: ...
VIBE: ...`
      : `You are a short-form social copywriter. Generate 3 compact caption variants for ${platform}.

User: ${username || 'builder'}
Tokens: ${tokenDesc}
Project: ${projectText || 'not provided'}
Metaphor: ${metaphor || 'none'}
Slogan: ${slogan || 'none'}
Ranking signal: ${rankingSignalLabel || 'not provided'}

Requirements:
- Output 3 variants: FLEX, HYPE, TECH
- Each variant must include TITLE / BODY / HASHTAGS / EMOJI / VIBE
- TITLE must be 8 words or fewer
- BODY must be only 1-2 short sentences
- HASHTAGS must contain no more than 2 hashtags
- TECH should carry the trust or ranking signal most naturally
- ${trustHint}
- Keep everything short, clear, and directly usable

Use this exact format:
TITLE: ...
BODY: ...
HASHTAGS: ...
EMOJI: ...
VIBE: ...`;

    const content = await callDeepSeek(apiKey as string, prompt, 320, 0.8);

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(requestOrigin) },
    });
  } catch (error) {
    console.error('generate-caption error:', error);
    const message = error instanceof Error && error.message === 'AI service temporarily unavailable'
      ? error.message
      : 'Internal server error';
    return jsonResponse({ error: message }, 500, requestOrigin);
  }
};
