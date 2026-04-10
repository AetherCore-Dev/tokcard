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
    const { allowed } = await checkRateLimit(namespace, ip, 'rate:metaphor');
    if (!allowed) {
      return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429, requestOrigin);
    }
  }

  try {
    const body = await context.request.json() as Record<string, unknown>;
    const tokens = Math.max(0, Number(body.tokens ?? 0));
    const locale = body.locale === 'en' ? 'en' : 'zh';
    const category = sanitizeForPrompt(String(body.category ?? 'flex'), 16);
    const primaryProjectName = sanitizeForPrompt(String(body.primaryProjectName ?? ''), 64);

    if (tokens === 0) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = (context.env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);

    const categoryGuide: Record<string, Record<string, string>> = {
      zh: {
        meme: '像爆梗，适合截图传播',
        flex: '像强势炫耀，但不油腻',
        shock: '像量级压制，直接给人冲击',
        selfMock: '像轻微自黑，带反差',
        scifi: '像未来科技设定',
        worker: '像高效打工人黑话',
      },
      en: {
        meme: 'meme-ready and repostable',
        flex: 'strong flex without sounding corny',
        shock: 'scale-heavy and instantly dramatic',
        selfMock: 'light self-roast with contrast',
        scifi: 'futuristic and sci-fi flavored',
        worker: 'builder productivity humor',
      },
    };

    const prompt = locale === 'zh'
      ? `你是一个短句比喻专家。请基于 token 用量生成 3 条比喻短句。

Token 用量：${tokenDesc}
主项目：${primaryProjectName || '未填写'}
风格：${categoryGuide.zh[category] ?? categoryGuide.zh.flex}

要求：
- 只输出 3 条，每行 1 条
- 每条以“= ”开头
- 每条不超过 18 个字
- 要有画面感、记忆点和传播感
- 不要解释，不要铺垫，不要写成长句

只输出短句。`
      : `You are a metaphor specialist. Generate 3 short metaphors from token usage.

Token usage: ${tokenDesc}
Primary project: ${primaryProjectName || 'not provided'}
Style: ${categoryGuide.en[category] ?? categoryGuide.en.flex}

Requirements:
- Output exactly 3 lines
- Each line starts with "= "
- Each line must be 12 words or fewer
- Make them vivid, memorable, and social-ready
- No explanations or setup

Output only the metaphor lines.`;

    const content = await callDeepSeek(apiKey as string, prompt, 120, 0.85);

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(requestOrigin) },
    });
  } catch (error) {
    console.error('generate-metaphor error:', error);
    const message = error instanceof Error && error.message === 'AI service temporarily unavailable'
      ? error.message
      : 'Internal server error';
    return jsonResponse({ error: message }, 500, requestOrigin);
  }
};
