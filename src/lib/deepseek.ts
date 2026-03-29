// DeepSeek API integration for AI-generated slogans and metaphors

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function generateSlogan(
  username: string,
  tokens: number,
  locale: 'zh' | 'en',
  apiKey: string
): Promise<string> {
  const tokenDesc = tokens >= 1e9 ? `${(tokens / 1e9).toFixed(1)}B`
    : tokens >= 1e6 ? `${(tokens / 1e6).toFixed(1)}M`
    : tokens >= 1e3 ? `${(tokens / 1e3).toFixed(0)}K`
    : `${tokens}`;

  const prompt = locale === 'zh'
    ? `你是一个AI开发者社交名片的文案专家。为用户"${username}"生成一句个性签名(slogan)，这个用户每月消耗${tokenDesc} tokens的AI算力。

要求：
- 最多15个字
- 有个性、有态度、有趣味
- 体现AI重度用户的身份认同
- 不要用"我是"开头
- 风格参考：科技感、极客范、略带自嘲幽默
- 可以中英文混用

只输出签名本身，不要解释。输出3个选项，每行一个。`
    : `You are a copywriter for AI developer social cards. Generate a slogan for "${username}" who consumes ${tokenDesc} tokens of AI compute monthly.

Requirements:
- Max 8 words
- Personality, attitude, wit
- Reflects heavy AI user identity
- Don't start with "I am"
- Style: techy, geeky, slightly self-deprecating humor

Output only the slogans, no explanation. Give 3 options, one per line.`;

  const res = await fetch(DEEPSEEK_API_URL, {
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

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const data: DeepSeekResponse = await res.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

export async function generateMetaphor(
  tokens: number,
  locale: 'zh' | 'en',
  apiKey: string
): Promise<string> {
  const tokenDesc = tokens >= 1e9 ? `${(tokens / 1e9).toFixed(1)}B`
    : tokens >= 1e6 ? `${(tokens / 1e6).toFixed(1)}M`
    : tokens >= 1e3 ? `${(tokens / 1e3).toFixed(0)}K`
    : `${tokens}`;

  const prompt = locale === 'zh'
    ? `你是一个AI用量比喻专家。用户本月消耗了${tokenDesc} tokens的AI算力(${tokens.toLocaleString()} tokens)。

请生成5个有趣的等价比喻，格式为"= XXX"。要求：
- 让人一看就觉得震撼或好笑
- 涵盖不同维度：代码量、文学作品、日常生活、热门AI产品、夸张幽默
- 数字要合理（1 token ≈ 0.75个英文单词，《三体》约65万字≈870K tokens）
- 每个比喻不超过20个字
- 越有传播力越好，要让人想转发

只输出比喻，每行一个，以"= "开头。`
    : `You are an AI usage metaphor expert. A user consumed ${tokenDesc} tokens this month (${tokens.toLocaleString()} tokens).

Generate 5 fun equivalent metaphors in "= XXX" format. Requirements:
- Shocking or funny at first glance
- Cover different dimensions: code, literature, daily life, popular AI products, humor
- Numbers should be reasonable (1 token ≈ 0.75 English words, "Harry Potter" full series ≈ 1.1M tokens)
- Each metaphor max 12 words
- Maximize shareability

Output only metaphors, one per line, starting with "= ".`;

  const res = await fetch(DEEPSEEK_API_URL, {
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

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const data: DeepSeekResponse = await res.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

// Parse multi-line AI response into array
export function parseAIOptions(response: string): string[] {
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('```'));
}
