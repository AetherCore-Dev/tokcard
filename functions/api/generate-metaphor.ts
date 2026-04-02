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

    if (tokens === 0) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = context.env?.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);

    const categoryGuide: Record<string, Record<string, string>> = {
      zh: {
        meme: '爆梗、热帖感、让人想转发',
        flex: '凡尔赛、炫耀、带压迫感',
        shock: '夸张震撼、量级拉满',
        selfMock: '自黑、反差、又惨又好笑',
        scifi: '科幻、赛博朋克、未来感',
        worker: '打工人、提效、班味幽默',
      },
      en: {
        meme: 'meme-heavy, internet-native, repost-worthy',
        flex: 'subtle flex, status, intimidating in a fun way',
        shock: 'big-scale, shocking, dramatic',
        selfMock: 'self-roast, contrast, painfully funny',
        scifi: 'sci-fi, cyberpunk, futuristic',
        worker: 'worker humor, productivity, office grind',
      },
    };

    const catTip = categoryGuide[locale][category] ?? categoryGuide[locale].flex;

    const prompt = locale === 'zh'
      ? `你是一个AI用量比喻专家。用户本月消耗了${tokenDesc} tokens的AI算力(${tokens.toLocaleString()} tokens)。

风格方向：${catTip}

请生成5个有趣的等价比喻，格式为"= XXX"。要求：
- 一眼就能看出很能打，适合截图发社交平台
- 严格贴合当前风格方向，不要平均用力
- 可以夸张，但要有内部逻辑和画面感
- 每个比喻不超过22个字
- 语言要利落，不要解释，不要铺垫
- 至少2条要有明显记忆点，像爆款短句

只输出比喻，每行一个，以"= "开头。`
      : `You are an AI usage metaphor expert. A user consumed ${tokenDesc} tokens this month (${tokens.toLocaleString()} tokens).

Style direction: ${catTip}

Generate 5 metaphors in "= XXX" format. Requirements:
- Screenshot-ready and social-shareable
- Stay tightly aligned with the chosen style
- Dramatic is good, but keep internal logic and vivid imagery
- Max 14 words each
- No explanations or setup
- At least 2 lines should feel instantly memorable

Output only metaphors, one per line, starting with "= ".`;

    const content = await callDeepSeek(apiKey as string, prompt, 300, 0.9);

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
