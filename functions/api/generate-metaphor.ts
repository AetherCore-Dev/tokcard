import type { Handler } from '@cloudflare/workers-types';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export const onRequest: Handler = async (context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS request
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only accept POST
  if (context.request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // Parse request body
    const body = await context.request.json();
    const { tokens, locale, category = 'flex' } = body;

    if (tokens === undefined || !locale) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get API key from environment
    const apiKey = context.env?.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('DEEPSEEK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Format token description
    const tokenDesc = tokens >= 1e9 ? `${(tokens / 1e9).toFixed(1)}B`
      : tokens >= 1e6 ? `${(tokens / 1e6).toFixed(1)}M`
      : tokens >= 1e3 ? `${(tokens / 1e3).toFixed(0)}K`
      : `${tokens}`;

    const categoryGuide = {
      meme: locale === 'zh' ? '爆梗、热帖感、让人想转发' : 'meme-heavy, internet-native, repost-worthy',
      flex: locale === 'zh' ? '凡尔赛、炫耀、带压迫感' : 'subtle flex, status, intimidating in a fun way',
      shock: locale === 'zh' ? '夸张震撼、量级拉满' : 'big-scale, shocking, dramatic',
      selfMock: locale === 'zh' ? '自黑、反差、又惨又好笑' : 'self-roast, contrast, painfully funny',
      scifi: locale === 'zh' ? '科幻、赛博朋克、未来感' : 'sci-fi, cyberpunk, futuristic',
      worker: locale === 'zh' ? '打工人、提效、班味幽默' : 'worker humor, productivity, office grind',
    } as const;

    // Build prompt
    const prompt = locale === 'zh'
      ? `你是一个AI用量比喻专家。用户本月消耗了${tokenDesc} tokens的AI算力(${tokens.toLocaleString()} tokens)。

风格方向：${categoryGuide[category as keyof typeof categoryGuide] ?? categoryGuide.flex}

请生成5个有趣的等价比喻，格式为"= XXX"。要求：
- 一眼就能看出很能打，适合截图发社交平台
- 严格贴合当前风格方向，不要平均用力
- 可以夸张，但要有内部逻辑和画面感
- 每个比喻不超过22个字
- 语言要利落，不要解释，不要铺垫
- 至少2条要有明显记忆点，像爆款短句

只输出比喻，每行一个，以"= "开头。`
      : `You are an AI usage metaphor expert. A user consumed ${tokenDesc} tokens this month (${tokens.toLocaleString()} tokens).

Style direction: ${categoryGuide[category as keyof typeof categoryGuide] ?? categoryGuide.flex}

Generate 5 metaphors in "= XXX" format. Requirements:
- Screenshot-ready and social-shareable
- Stay tightly aligned with the chosen style
- Dramatic is good, but keep internal logic and vivid imagery
- Max 14 words each
- No explanations or setup
- At least 2 lines should feel instantly memorable

Output only metaphors, one per line, starting with "= ".`;

    // Call DeepSeek API
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      return new Response(
        JSON.stringify({ error: `DeepSeek API error: ${response.status}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const data: DeepSeekResponse = await response.json();
    const content = data.choices[0]?.message?.content?.trim() || '';

    return new Response(
      JSON.stringify({ content }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('generate-metaphor error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
