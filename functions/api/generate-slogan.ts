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
    const titleMode = sanitizeForPrompt(String(body.titleMode ?? 'social'), 16);
    const primaryProjectName = sanitizeForPrompt(String(body.primaryProjectName ?? ''), 64);
    const primaryProjectPitch = sanitizeForPrompt(String(body.primaryProjectPitch ?? ''), 120);

    if (!tokens) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = (context.env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);

    const styleGuide: Record<string, Record<string, string>> = {
      zh: {
        flex: '强势、能打、带排面',
        selfMock: '轻微自黑、反差、有记忆点',
        hype: '短、猛、适合传播',
        geek: '极客、冷静、像懂行的人写的',
      },
      en: {
        flex: 'strong, status-heavy, flex-worthy',
        selfMock: 'light self-roast with contrast',
        hype: 'short, punchy, built to travel',
        geek: 'geeky, clean, credible to builders',
      },
    };

    const modeGuide: Record<string, Record<string, string>> = {
      zh: {
        personal: '更像个人身份标签',
        project: '更像项目发声口号',
        social: '更像社交平台标题',
      },
      en: {
        personal: 'more like a personal identity tag',
        project: 'more like a project-facing line',
        social: 'more like a social headline',
      },
    };

    const prompt = locale === 'zh'
      ? `你是一个顶级短句文案专家。请为一位 AI builder 生成 3 条 slogan。

用户昵称：${username || 'builder'}
Token 用量：${tokenDesc}
主项目：${primaryProjectName || '未填写'}
项目介绍：${primaryProjectPitch || '未填写'}
风格：${styleGuide.zh[style] ?? styleGuide.zh.hype}
模式：${modeGuide.zh[titleMode] ?? modeGuide.zh.social}

要求：
- 只输出 3 条，每行 1 条
- 每条不超过 12 个字
- 要短、狠、准
- 可以带数字、结果感、压迫感或反差幽默
- 不要空话，不要鸡汤，不要解释
- 尽量和 token 用量或项目身份有关

只输出短句本身。`
      : `You are an elite micro-copy writer. Generate 3 slogans for an AI builder.

Username: ${username || 'builder'}
Token usage: ${tokenDesc}
Primary project: ${primaryProjectName || 'not provided'}
Project pitch: ${primaryProjectPitch || 'not provided'}
Style: ${styleGuide.en[style] ?? styleGuide.en.hype}
Mode: ${modeGuide.en[titleMode] ?? modeGuide.en.social}

Requirements:
- Output exactly 3 lines
- Each line must be 15 words or fewer
- Keep them short, sharp, and high-signal
- They may include numbers, results, flex energy, or contrast humor
- Avoid generic, motivational, or explanatory copy
- Tie them to token usage or project identity when possible

Output only the slogans.`;

    const content = await callDeepSeek(apiKey as string, prompt, 120, 0.8);

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
