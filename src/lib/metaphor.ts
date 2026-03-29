// Metaphor/analogy engine - the #1 viral sharing factor

export interface Metaphor {
  zh: string;
  en: string;
}

interface MetaphorRange {
  min: number;
  max: number; // Infinity for the top tier
  metaphors: Record<'programmer' | 'culture' | 'life' | 'meme', Metaphor[]>;
}

const METAPHOR_RANGES: MetaphorRange[] = [
  {
    min: 0,
    max: 1_000_000,
    metaphors: {
      programmer: [
        { zh: '让 AI 帮你写了一个 Hello World', en: 'Had AI write you a Hello World' },
        { zh: '相当于让 AI 读了一份简历', en: 'Like having AI read a resume' },
      ],
      culture: [
        { zh: '读了一本薄薄的诗集', en: 'Read a slim poetry book' },
        { zh: '翻了几页《小王子》', en: 'Flipped through a few pages of The Little Prince' },
      ],
      life: [
        { zh: '和 AI 聊了一个下午', en: 'Chatted with AI for an afternoon' },
        { zh: '让 AI 帮你点了一杯咖啡', en: 'Had AI order you a coffee' },
      ],
      meme: [
        { zh: '让 DeepSeek 算了一道小学数学题', en: 'Had DeepSeek solve a grade school math problem' },
        { zh: 'AI 刚热完身', en: 'AI just finished warming up' },
      ],
    },
  },
  {
    min: 1_000_000,
    max: 10_000_000,
    metaphors: {
      programmer: [
        { zh: '让 AI 帮你 review 了 4,600 行代码', en: 'Had AI review 4,600 lines of code' },
        { zh: '相当于用 AI 写了一个完整的 TODO 应用', en: 'Like using AI to build a complete TODO app' },
      ],
      culture: [
        { zh: '把《红楼梦》通读了一遍', en: 'Read "Dream of the Red Chamber" cover to cover' },
        { zh: '读了 3 本《哈利波特》', en: 'Read 3 Harry Potter books' },
      ],
      life: [
        { zh: '和 AI 连续聊了 2 周', en: 'Chatted with AI non-stop for 2 weeks' },
        { zh: '你的 AI 已经认识你了', en: 'Your AI already knows you' },
      ],
      meme: [
        { zh: '够 Sora 生成 10 个短视频', en: 'Enough for Sora to generate 10 short videos' },
        { zh: 'AI: 我还能再卷一卷', en: 'AI: I can grind a bit more' },
      ],
    },
  },
  {
    min: 10_000_000,
    max: 100_000_000,
    metaphors: {
      programmer: [
        { zh: '让 AI 帮你 review 了 46,000 行代码', en: 'Had AI review 46,000 lines of code' },
        { zh: '相当于用 AI 从零搭了一个 SaaS 产品', en: 'Like using AI to build a SaaS product from scratch' },
      ],
      culture: [
        { zh: '把唐诗三百首背了 760 遍', en: 'Memorized "300 Tang Poems" 760 times' },
        { zh: '读完了《三体》三部曲 15 遍', en: 'Read the "Three-Body Problem" trilogy 15 times' },
      ],
      life: [
        { zh: '和 AI 连续聊了半年', en: 'Chatted with AI for half a year straight' },
        { zh: '你的 AI 比你的同事更了解你的代码', en: 'Your AI knows your code better than your colleagues' },
      ],
      meme: [
        { zh: '够 DeepSeek 解了 23 万道数学题', en: 'Enough for DeepSeek to solve 230K math problems' },
        { zh: 'AI 的 GPU 为你燃烧', en: 'GPUs are burning just for you' },
      ],
    },
  },
  {
    min: 100_000_000,
    max: 1_000_000_000,
    metaphors: {
      programmer: [
        { zh: '让 AI 帮你 review 了 46 万行代码', en: 'Had AI review 460K lines of code' },
        { zh: '相当于一个 10 人团队写了一个季度', en: 'Like a 10-person team coding for a quarter' },
      ],
      culture: [
        { zh: '把《三体》读了 150 遍', en: 'Read "Three-Body Problem" 150 times' },
        { zh: '读完了整个维基百科的 1/3', en: 'Read 1/3 of all of Wikipedia' },
      ],
      life: [
        { zh: '和 AI 连续聊了 4.2 年', en: 'Chatted with AI for 4.2 years straight' },
        { zh: '你和 AI 的对话够出一本书了', en: 'Your AI conversations could fill a book' },
      ],
      meme: [
        { zh: '够 Sora 生成 1 万个视频', en: 'Enough for Sora to generate 10K videos' },
        { zh: '你的电费单可能需要关注一下', en: 'You might want to check your electricity bill' },
      ],
    },
  },
  {
    min: 1_000_000_000,
    max: 10_000_000_000,
    metaphors: {
      programmer: [
        { zh: '你一个人 = 一个 50 人工程团队', en: 'You alone = a 50-person engineering team' },
        { zh: '让 AI 帮你 review 了 460 万行代码', en: 'Had AI review 4.6M lines of code' },
      ],
      culture: [
        { zh: '把《三体》三部曲读了 1,500 遍', en: 'Read "Three-Body Problem" trilogy 1,500 times' },
        { zh: '读完了整个维基百科 3 遍', en: 'Read all of Wikipedia 3 times' },
      ],
      life: [
        { zh: '你的 AI 比你的伴侣更了解你', en: 'Your AI knows you better than your partner' },
        { zh: '和 AI 聊了 42 年不停歇', en: 'Chatted with AI for 42 years non-stop' },
      ],
      meme: [
        { zh: '相当于训练了一个小型语言模型', en: 'Like training a small language model' },
        { zh: '英伟达因为你多卖了一块 H100', en: 'NVIDIA sold one more H100 because of you' },
      ],
    },
  },
  {
    min: 10_000_000_000,
    max: 100_000_000_000,
    metaphors: {
      programmer: [
        { zh: '你一个人用的算力 = 一个中型科技公司', en: 'Your compute usage = a mid-size tech company' },
        { zh: '相当于训练了一个中型语言模型', en: 'Like training a medium-sized language model' },
      ],
      culture: [
        { zh: '把全球所有已出版的书翻了一遍', en: 'Browsed through every published book on Earth' },
        { zh: '让 AI 写了 1000 本哈利波特', en: 'Had AI write 1,000 Harry Potter books' },
      ],
      life: [
        { zh: '你的 AI 用量可以供一个小城市用一年', en: 'Your AI usage could power a small city for a year' },
        { zh: 'AI 认为你是它最好的朋友', en: 'AI thinks you are its best friend' },
      ],
      meme: [
        { zh: '山姆·奥特曼亲自给你发了感谢信', en: 'Sam Altman sent you a personal thank-you note' },
        { zh: '你的 token 消耗可以上新闻了', en: 'Your token usage is newsworthy' },
      ],
    },
  },
  {
    min: 100_000_000_000,
    max: Infinity,
    metaphors: {
      programmer: [
        { zh: '你一个人的算力消耗 = 一个独角兽公司', en: 'Your compute = a unicorn company' },
        { zh: '相当于从零训练了 GPT-4', en: 'Like training GPT-4 from scratch' },
      ],
      culture: [
        { zh: '把人类文明的所有文字都读了一遍', en: 'Read every word human civilization ever wrote' },
        { zh: '你的对话量可以创建一种新语言', en: 'Your conversations could create a new language' },
      ],
      life: [
        { zh: '如果 AI 有感情, 它已经爱上你了', en: 'If AI had feelings, it would be in love with you' },
        { zh: '你可能是地球上最了解 AI 的人类', en: 'You might be the human who knows AI best on Earth' },
      ],
      meme: [
        { zh: '你是传说中的奇点本人', en: 'You ARE the singularity' },
        { zh: 'AGI 的诞生有你一份功劳', en: 'AGI owes part of its birth to you' },
      ],
    },
  },
];

export type MetaphorCategory = 'programmer' | 'culture' | 'life' | 'meme';

export function getMetaphor(tokens: number, category: MetaphorCategory, locale: 'zh' | 'en' = 'zh'): string {
  const range = METAPHOR_RANGES.find(r => tokens >= r.min && tokens < r.max) || METAPHOR_RANGES[0];
  const metaphors = range.metaphors[category];
  const selected = metaphors[Math.floor(Math.random() * metaphors.length)];
  return locale === 'zh' ? selected.zh : selected.en;
}

export function getAllMetaphorsForTokens(tokens: number, locale: 'zh' | 'en' = 'zh'): Record<MetaphorCategory, string> {
  return {
    programmer: getMetaphor(tokens, 'programmer', locale),
    culture: getMetaphor(tokens, 'culture', locale),
    life: getMetaphor(tokens, 'life', locale),
    meme: getMetaphor(tokens, 'meme', locale),
  };
}

export const METAPHOR_CATEGORY_LABELS: Record<MetaphorCategory, { zh: string; en: string }> = {
  programmer: { zh: '程序员版', en: 'Developer' },
  culture: { zh: '文化版', en: 'Cultural' },
  life: { zh: '生活版', en: 'Life' },
  meme: { zh: '梗版', en: 'Meme' },
};
