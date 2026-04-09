import type { Handler } from '@cloudflare/workers-types';
import { buildCorsHeaders, handleOptions, jsonResponse, validateOrigin } from '../lib/cors';
import { checkRateLimit } from '../lib/rate-limit';
import { callDeepSeek, formatTokenValue, sanitizeForPrompt } from '../lib/deepseek';

export const onRequest: Handler = async (context) => {
  const requestOrigin = context.request.headers.get('Origin');

  const originError = validateOrigin(requestOrigin);
  if (originError) return originError;

  if (context.request.method === 'OPTIONS') {
    return handleOptions(requestOrigin);
  }

  if (context.request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin);
  }

  // Rate limiting
  const namespace = context.env?.TOKCARD_METRICS as KVNamespace | undefined;
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
    const projectUrl = String(body.projectUrl ?? '');
    const tokens = Math.max(0, Number(body.tokens ?? 0));
    const locale = body.locale === 'en' ? 'en' : 'zh';

    if (!projectName) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = context.env?.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);

    const prompt = locale === 'zh'
      ? `你是一个AI项目一句话介绍专家。用户正在用TokCard展示他们的AI项目，需要为项目生成精炼的一句话介绍。

项目名称: ${projectName}
${projectUrl ? `项目链接: ${projectUrl}` : ''}
${tokens > 0 ? `用户每月AI算力消耗: ${tokenDesc}` : ''}

要求：
- 生成3个候选介绍，每行一个
- 每个介绍不超过24个字
- 突出用户价值、速度、规模、雄心或成果
- 避免通用描述和模板化语言
- 至少1条强调技术优势，1条强调用户价值
- 语言要精炼、有冲击力、适合分享

只输出介绍本身，不要解释。每个介绍一行。`
      : `You are an expert at creating one-line project pitches for AI projects. A user needs a concise one-line introduction for their project to showcase on TokCard.

Project name: ${projectName}
${projectUrl ? `Project URL: ${projectUrl}` : ''}
${tokens > 0 ? `User's monthly AI compute: ${tokenDesc}` : ''}

Requirements:
- Generate 3 candidate pitches, one per line
- Each pitch max 12 words
- Emphasize user value, speed, scale, ambition, or results
- Avoid generic descriptions and template language
- At least 1 should highlight technical advantage, 1 should highlight user value
- Language should be concise, impactful, and shareable

Output only the pitches, no explanations. One pitch per line.`;

    const content = await callDeepSeek(apiKey as string, prompt, 200, 0.9);

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