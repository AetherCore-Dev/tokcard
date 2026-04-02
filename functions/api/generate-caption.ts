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
    const { allowed } = await checkRateLimit(namespace, ip, 'rate:caption');
    if (!allowed) {
      return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429, requestOrigin);
    }
  }

  try {
    const body = await context.request.json() as Record<string, unknown>;
    const platform = sanitizeForPrompt(String(body.platform ?? ''), 32);
    const tokens = Math.max(0, Number(body.tokens ?? 0));
    const metaphor = sanitizeForPrompt(String(body.metaphor ?? ''), 200);
    const username = sanitizeForPrompt(String(body.username ?? ''), 32);
    const locale = body.locale === 'en' ? 'en' : 'zh';
    const rawProjects = Array.isArray(body.projects) ? body.projects : [];
    const projects = rawProjects.map((p: unknown) => sanitizeForPrompt(String(p ?? ''), 32)).slice(0, 5);
    const slogan = sanitizeForPrompt(String(body.slogan ?? ''), 200);
    const trustTier = sanitizeForPrompt(String(body.trustTier ?? 'self-reported'), 32);
    const trustTierLabel = sanitizeForPrompt(String(body.trustTierLabel ?? ''), 32);
    const proofSource = sanitizeForPrompt(String(body.proofSource ?? ''), 32);
    const proofSourceLabel = sanitizeForPrompt(String(body.proofSourceLabel ?? ''), 32);
    const proofRangeLabel = sanitizeForPrompt(String(body.proofRangeLabel ?? ''), 64);
    const rankingSignalLabel = sanitizeForPrompt(String(body.rankingSignalLabel ?? ''), 64);
    const rankingSignalDescription = sanitizeForPrompt(String(body.rankingSignalDescription ?? ''), 128);

    if (!platform || tokens === 0 || !username) {
      return jsonResponse({ error: 'Missing required fields' }, 400, requestOrigin);
    }

    const apiKey = context.env?.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 503, requestOrigin);
    }

    const tokenDesc = formatTokenValue(tokens);
    const projectText = projects.length ? projects.join(', ') : (locale === 'zh' ? '暂无项目名' : 'no featured projects');
    const trustContext = locale === 'zh'
      ? [
          `- 可信等级：${trustTierLabel || trustTier}`,
          proofSourceLabel ? `- 数据来源：${proofSourceLabel}` : `- 数据来源：${proofSource || '未指定'}`,
          proofRangeLabel ? `- 时间范围：${proofRangeLabel}` : null,
          rankingSignalLabel ? `- 排名表达：${rankingSignalLabel}` : null,
          rankingSignalDescription ? `- 排名说明：${rankingSignalDescription}` : null,
        ].filter(Boolean).join('\n')
      : [
          `- trust tier: ${trustTierLabel || trustTier}`,
          `- proof source: ${proofSourceLabel || proofSource || 'unspecified'}`,
          proofRangeLabel ? `- proof range: ${proofRangeLabel}` : null,
          rankingSignalLabel ? `- ranking phrasing: ${rankingSignalLabel}` : null,
          rankingSignalDescription ? `- ranking note: ${rankingSignalDescription}` : null,
        ].filter(Boolean).join('\n');

    const trustInstruction = locale === 'zh'
      ? (trustTier === 'self-reported'
          ? '文案里可以自然表达这是当前阶段的 TokCard / 档位信号，但不要伪装成官方验证或真实全站榜单。'
          : trustTier === 'screenshot-backed'
            ? '文案里要自然带出"截图佐证 / proof attached"的可信感，但不要写得像审计报告。'
            : '文案里要自然表达"基于 usage 导入记录 / imported usage"带来的可信度，同时保持适合社交发布。')
      : (trustTier === 'self-reported'
          ? 'The copy may frame this as the current TokCard / tier signal, but must not sound like an official verified leaderboard claim.'
          : trustTier === 'screenshot-backed'
            ? 'Naturally signal screenshot-backed credibility or proof attached, without sounding like an audit report.'
            : 'Naturally express that the card is based on imported usage records, while still sounding shareable and social.');

    const prompt = locale === 'zh'
      ? `你是顶级社交传播文案专家。请为一位用户生成 3 版适合 ${platform} 发布的 AI 晒图文案。

用户昵称: ${username}
信息：
- token 用量：${tokenDesc}
- 当前签名：${slogan || '无'}
- 当前比喻：${metaphor || '无'}
- 展示项目：${projectText}
${trustContext}

额外要求：
- ${trustInstruction}
- 让文案既有传播欲，也让 AI 开发者觉得表达是可信、克制、像 builder 本人会发的。
- TECH 版本必须最自然地体现 trust 信息。

请输出 3 个版本，分别是：
1. FLEX：强势炫耀型
2. HYPE：爆款传播型
3. TECH：技术可信型

每个版本都必须包含：
- title: 标题，18字以内
- body: 正文，2-3 句
- hashtags: 3 个标签，空格分隔
- emoji: 1 个开头 emoji
- vibe: 只能是 flex / hype / technical

严格使用以下格式输出，版本之间空一行：
TITLE: ...
BODY: ...
HASHTAGS: ...
EMOJI: ...
VIBE: ...`
      : `You are a viral social copywriter. Generate 3 caption variants for a user to post on ${platform}.

Username: ${username}
Context:
- token usage: ${tokenDesc}
- slogan: ${slogan || 'none'}
- metaphor: ${metaphor || 'none'}
- featured projects: ${projectText}
${trustContext}

Extra requirements:
- ${trustInstruction}
- Keep the copy social and shareable, but credible enough for AI developers.
- The TECH version should carry the trust context most clearly.

Generate exactly 3 variants:
1. FLEX: proud and impressive
2. HYPE: punchy and viral
3. TECH: credible and technical

Each variant must include:
- TITLE: under 12 words
- BODY: 2-3 sentences
- HASHTAGS: 3 hashtags separated by spaces
- EMOJI: 1 emoji
- VIBE: flex / hype / technical

Use this exact format, with a blank line between variants:
TITLE: ...
BODY: ...
HASHTAGS: ...
EMOJI: ...
VIBE: ...`;

    const content = await callDeepSeek(apiKey as string, prompt, 500, 0.9);

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
