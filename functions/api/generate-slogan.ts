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
    const { username, tokens, locale, style = 'hype' } = body;

    if (!username || tokens === undefined || !locale) {
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

    const styleGuide = {
      flex: locale === 'zh' ? '低调炫耀、凡尔赛、带排面' : 'subtle flex, prestige, status energy',
      selfMock: locale === 'zh' ? '自嘲、反差、打工人幽默' : 'self-roast, contrast, worker humor',
      hype: locale === 'zh' ? '爆款、带压迫感、适合晒朋友圈' : 'viral, punchy, built for sharing',
      geek: locale === 'zh' ? '极客、科技感、开发者黑话' : 'geeky, technical, dev-native',
    } as const;

    // Build prompt
    const prompt = locale === 'zh'
      ? `你是一个AI开发者社交名片的爆款文案专家。为用户"${username}"生成个性签名(slogan)，这个用户每月消耗${tokenDesc} tokens的AI算力。

风格方向：${styleGuide[style as keyof typeof styleGuide] ?? styleGuide.hype}

要求：
- 最多16个字
- 有炫耀感、记忆点、传播感
- 读起来像能被截图转发的句子
- 不要太普通，不要鸡汤，不要模板腔
- 不要用“我是”开头
- 可以适度中英混用
- 至少1条带轻微凡尔赛，至少1条带幽默反差

只输出签名本身，不要解释。输出5个选项，每行一个。`
      : `You are writing viral copy for an AI developer social card. Create slogans for "${username}", who burns ${tokenDesc} tokens of AI compute monthly.

Style direction: ${styleGuide[style as keyof typeof styleGuide] ?? styleGuide.hype}

Requirements:
- Max 10 words
- Memorable, flex-worthy, shareable
- Should feel screenshot-ready for social posts
- Avoid generic motivational tone
- Do not start with "I am"
- Include at least one subtle flex and one funny contrast

Output only the slogans. Give 5 options, one per line.`;

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
        max_tokens: 150,
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
    console.error('generate-slogan error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
