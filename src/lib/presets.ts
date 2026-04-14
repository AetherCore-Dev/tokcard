import type { CardData } from '@/lib/card';

export interface CardPreset {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  emoji: string;
  accent: string;
  preview: string;
  previewTone: 'light' | 'dark';
  platform: CardData['platform'];
  defaults: Partial<CardData>;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'x-ship-mode',
    name: 'X 产品发布款',
    nameEn: 'X Ship Mode',
    description: '更适合发 X / Twitter，强调 build 强度和发布感。',
    descriptionEn: 'Built for X with sharper ship-fast energy.',
    emoji: '✦',
    accent: '#4f46e5',
    preview: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #8b5cf6 100%)',
    previewTone: 'dark',
    platform: 'twitter',
    defaults: {
      channel: 'claude',
      theme: 'brand-dark',
      backgroundType: 'preset',
      backgroundValue: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #8b5cf6 100%)',
      platform: 'twitter',
      metaphorCategory: 'flex',
      avatarType: 'emoji',
      avatarValue: '✦',
      slogan: 'Ship it, then show the proof',
      modelBreakdown: [
        { name: 'Claude', percentage: 64, color: '#d97706' },
        { name: 'GPT', percentage: 22, color: '#10b981' },
        { name: 'Cursor', percentage: 14, color: '#6529c4' },
      ],
    },
  },
  {
    id: 'linkedin-builder-proof',
    name: 'LinkedIn 专业名片款',
    nameEn: 'LinkedIn Proof Card',
    description: '适合主页、LinkedIn 和对外介绍，强调可信与专业。',
    descriptionEn: 'Made for portfolio sharing and a more credible first impression.',
    emoji: '▣',
    accent: '#2563eb',
    preview: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 48%, #dbeafe 100%)',
    previewTone: 'light',
    platform: 'linkedin',
    defaults: {
      channel: 'gpt',
      theme: 'minimal-gray',
      backgroundType: 'preset',
      backgroundValue: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 48%, #dbeafe 100%)',
      platform: 'linkedin',
      metaphorCategory: 'worker',
      avatarType: 'emoji',
      avatarValue: '🧠',
      slogan: 'Build with AI, ship with clarity',
      modelBreakdown: [
        { name: 'GPT', percentage: 42, color: '#10b981' },
        { name: 'Claude', percentage: 34, color: '#d97706' },
        { name: 'Gemini', percentage: 24, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'wechat-trust-builder',
    name: '微信朋友圈通用款',
    nameEn: 'WeChat Moments Classic',
    description: '统一用于微信和朋友圈，风格更克制，优先保证整体美观和一致性。',
    descriptionEn: 'A single WeChat and Moments preset that prioritizes visual consistency and polish.',
    emoji: '◉',
    accent: '#0f766e',
    preview: 'linear-gradient(135deg, #f7fffc 0%, #dcfce7 44%, #bbf7d0 100%)',
    previewTone: 'light',
    platform: 'wechat',
    defaults: {
      channel: 'claude',
      theme: 'brand-light',
      backgroundType: 'preset',
      backgroundValue: 'linear-gradient(135deg, #f7fffc 0%, #dcfce7 44%, #bbf7d0 100%)',
      platform: 'wechat',
      metaphorCategory: 'worker',
      avatarType: 'emoji',
      avatarValue: '🪪',
      slogan: '把 AI 用量和项目讲清楚',
      modelBreakdown: [
        { name: 'Claude', percentage: 58, color: '#d97706' },
        { name: 'GPT', percentage: 26, color: '#10b981' },
        { name: 'Cursor', percentage: 16, color: '#6529c4' },
      ],
    },
  },
  {
    id: 'weibo-hot-launch',
    name: '微博热点款',
    nameEn: 'Weibo Hot Launch',
    description: '更适合微博转发与传播，标题和项目信息更抓眼。',
    descriptionEn: 'Optimized for repost energy and launch-style visibility on Weibo.',
    emoji: '✺',
    accent: '#ef4444',
    preview: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 48%, #fecdd3 100%)',
    previewTone: 'light',
    platform: 'weibo',
    defaults: {
      channel: 'deepseek',
      theme: 'brand-light',
      backgroundType: 'preset',
      backgroundValue: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 48%, #fecdd3 100%)',
      platform: 'weibo',
      metaphorCategory: 'shock',
      avatarType: 'emoji',
      avatarValue: '📣',
      slogan: '别人发动态，我发 AI 战绩',
      modelBreakdown: [
        { name: 'DeepSeek', percentage: 46, color: '#1652f0' },
        { name: 'Claude', percentage: 30, color: '#d97706' },
        { name: 'GPT', percentage: 24, color: '#10b981' },
      ],
    },
  },
  {
    id: 'xiaohongshu-glow',
    name: '小红书精致传播款',
    nameEn: 'Xiaohongshu Glow',
    description: '适合小红书，强调颜值、项目感和分享欲。',
    descriptionEn: 'Built for Xiaohongshu with a softer, polished visual vibe.',
    emoji: '✿',
    accent: '#db2777',
    preview: 'linear-gradient(135deg, #fff7ed 0%, #fdf2f8 50%, #fce7f3 100%)',
    previewTone: 'light',
    platform: 'xiaohongshu',
    defaults: {
      channel: 'gpt',
      theme: 'brand-light',
      backgroundType: 'preset',
      backgroundValue: 'linear-gradient(135deg, #fff7ed 0%, #fdf2f8 50%, #fce7f3 100%)',
      platform: 'xiaohongshu',
      metaphorCategory: 'meme',
      avatarType: 'emoji',
      avatarValue: '✨',
      slogan: '让项目和 token 一起变成分享欲',
      modelBreakdown: [
        { name: 'GPT', percentage: 52, color: '#10b981' },
        { name: 'Claude', percentage: 28, color: '#d97706' },
        { name: 'Gemini', percentage: 20, color: '#ef4444' },
      ],
    },
  },
];
