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
    const tokenWindow = body.tokenWindow === 'day' || body.tokenWindow === 'week' || body.tokenWindow === 'month'
      ? body.tokenWindow
      : 'month';

    if (!tokens) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = (context.env as { DEEPSEEK_API_KEY?: string }).DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);
    const tokenWindowLabel = locale === 'zh'
      ? (tokenWindow === 'day' ? '今日' : tokenWindow === 'week' ? '本周' : '本月')
      : (tokenWindow === 'day' ? 'today' : tokenWindow === 'week' ? 'this week' : 'this month');

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
统计周期：${tokenWindowLabel}
主项目：${primaryProjectName || '未填写'}
项目介绍：${primaryProjectPitch || '未填写'}
风格：${styleGuide.zh[style] ?? styleGuide.zh.hype}
模式：${modeGuide.zh[titleMode] ?? modeGuide.zh.social}

要求：
- 只输出 3 条，每行 1 条
- 每条尽量控制在 4 到 8 个字，不要超过 10 个字
- 要像能直接贴在卡片上的一句爆点短句，不要像介绍文
- 优先写结果感、身份感、传播钩子
- 至少有 1 条能自然带到 ${tokenWindowLabel} / token 强度 / 项目结果
- 可以带数字、战绩、排名压迫感或轻微反差幽默
- 不要空话，不要鸡汤，不要解释，不要重复同一套句式
- 读完要有“想复制”的感觉

只输出短句本身。`
      : `You are an elite micro-copy writer. Generate 3 slogans for an AI builder.

Username: ${username || 'builder'}
Token usage: ${tokenDesc}
Token window: ${tokenWindowLabel}
Primary project: ${primaryProjectName || 'not provided'}
Project pitch: ${primaryProjectPitch || 'not provided'}
Style: ${styleGuide.en[style] ?? styleGuide.en.hype}
Mode: ${modeGuide.en[titleMode] ?? modeGuide.en.social}

Requirements:
- Output exactly 3 lines
- Each line should ideally be 2 to 6 words, and must stay within 10 words
- Make each line feel like card-ready micro-copy, not a description
- Prioritize signal, identity, and social-hook energy
- At least 1 line should naturally hint at the token window, token scale, or project outcome
- They may include numbers, results, flex energy, ranking pressure, or contrast humor
- Avoid generic, motivational, explanatory, or repetitive phrasing
- Every line should feel sharp enough to copy-paste directly

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
