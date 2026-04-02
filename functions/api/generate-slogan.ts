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
    const { allowed } = await checkRateLimit(namespace, ip, 'rate:slogan');
    if (!allowed) {
      return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429, requestOrigin);
    }
  }

  try {
    const body = await context.request.json() as Record<string, unknown>;
    const username = sanitizeForPrompt(String(body.username ?? ''), 32);
    const tokens = Math.max(0, Number(body.tokens ?? 0));
    const locale = body.locale === 'en' ? 'en' : 'zh';
    const style = sanitizeForPrompt(String(body.style ?? 'hype'), 16);
    const titleMode = sanitizeForPrompt(String(body.titleMode ?? 'personal'), 16);

    if (!username || tokens === 0) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = context.env?.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);

    const styleGuide: Record<string, Record<string, string>> = {
      zh: {
        flex: '低调炫耀、凡尔赛、带排面',
        selfMock: '自嘲、反差、打工人幽默',
        hype: '爆款、带压迫感、适合晒朋友圈',
        geek: '极客、科技感、开发者黑话',
      },
      en: {
        flex: 'subtle flex, prestige, status energy',
        selfMock: 'self-roast, contrast, worker humor',
        hype: 'viral, punchy, built for sharing',
        geek: 'geeky, technical, dev-native',
      },
    };

    const modeGuide: Record<string, Record<string, string>> = {
      zh: {
        personal: '突出人的气场、身份感、个人能力',
        project: '更像项目名片，强调作品和产出',
        social: '更像社交平台标题，强调传播和评论欲',
      },
      en: {
        personal: 'focus on personal aura, identity, and capability',
        project: 'feel like a project business card, emphasizing output',
        social: 'feel like a social headline built for reposts and comments',
      },
    };

    const styleTip = styleGuide[locale][style] ?? styleGuide[locale].hype;
    const modeTip = modeGuide[locale][titleMode] ?? modeGuide[locale].personal;

    const prompt = locale === 'zh'
      ? `你是一个AI开发者社交名片的爆款文案专家。为用户生成个性签名(slogan)，这个用户每月消耗${tokenDesc} tokens的AI算力。

用户昵称: ${username}
风格方向：${styleTip}
模式方向：${modeTip}

要求：
- 最多16个字
- 有炫耀感、记忆点、传播感
- 读起来像能被截图转发的句子
- 不要太普通，不要鸡汤，不要模板腔
- 不要用"我是"开头
- 可以适度中英混用
- 至少1条带轻微凡尔赛，至少1条带幽默反差

只输出签名本身，不要解释。输出5个选项，每行一个。`
      : `You are writing viral copy for an AI developer social card. Create slogans for a user who burns ${tokenDesc} tokens of AI compute monthly.

Username: ${username}
Style direction: ${styleTip}
Mode direction: ${modeTip}

Requirements:
- Max 10 words
- Memorable, flex-worthy, shareable
- Should feel screenshot-ready for social posts
- Avoid generic motivational tone
- Do not start with "I am"
- Include at least one subtle flex and one funny contrast

Output only the slogans. Give 5 options, one per line.`;

    const content = await callDeepSeek(apiKey as string, prompt, 150, 0.9);

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(requestOrigin) },
    });
  } catch (error) {
    console.error('generate-slogan error:', error);
    const message = error instanceof Error && error.message === 'AI service temporarily unavailable'
      ? error.message
      : 'Internal server error';
    return jsonResponse({ error: message }, 500, requestOrigin);
  }
};
