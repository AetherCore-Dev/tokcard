import type { CardData } from '@/lib/card';

export interface CardPreset {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  emoji: string;
  accent: string;
  defaults: Partial<CardData>;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'token-flex',
    name: 'Token 排面款',
    nameEn: 'Token Flex',
    description: '突出 token 体量和当前档位，适合晒战绩。',
    descriptionEn: 'Built to spotlight token volume and rank energy.',
    emoji: '🔥',
    accent: '#f97316',
    defaults: {
      channel: 'claude',
      theme: 'brand-dark',
      backgroundType: 'none',
      backgroundValue: '',
      platform: 'wechat',
      metaphorCategory: 'flex',
      avatarType: 'emoji',
      avatarValue: '🔥',
      slogan: '不是总结，是压迫感',
      modelBreakdown: [
        { name: 'Claude', percentage: 68, color: '#d97706' },
        { name: 'GPT', percentage: 20, color: '#10b981' },
        { name: 'Cursor', percentage: 12, color: '#6529c4' },
      ],
    },
  },
  {
    id: 'project-launch',
    name: '项目发布款',
    nameEn: 'Project Launch',
    description: '更适合突出项目名称和一句话介绍。',
    descriptionEn: 'Built to make the main project the hero.',
    emoji: '🚀',
    accent: '#7c3aed',
    defaults: {
      channel: 'gpt',
      theme: 'brand-light',
      backgroundType: 'none',
      backgroundValue: '',
      platform: 'xiaohongshu',
      metaphorCategory: 'meme',
      avatarType: 'emoji',
      avatarValue: '🚀',
      slogan: '让项目自己说服别人',
      modelBreakdown: [
        { name: 'GPT', percentage: 52, color: '#10b981' },
        { name: 'Claude', percentage: 28, color: '#d97706' },
        { name: 'Gemini', percentage: 20, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'pro-builder',
    name: '专业名片款',
    nameEn: 'Pro Builder',
    description: '偏克制、偏可信，适合主页和 LinkedIn。',
    descriptionEn: 'More restrained and credible for portfolio sharing.',
    emoji: '🧠',
    accent: '#111827',
    defaults: {
      channel: 'gpt',
      theme: 'minimal-gray',
      backgroundType: 'none',
      backgroundValue: '',
      platform: 'linkedin',
      metaphorCategory: 'worker',
      avatarType: 'emoji',
      avatarValue: '🧠',
      slogan: 'Build with AI, ship with clarity',
      modelBreakdown: [
        { name: 'GPT', percentage: 40, color: '#10b981' },
        { name: 'Claude', percentage: 36, color: '#d97706' },
        { name: 'Gemini', percentage: 24, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'social-hype',
    name: '社交传播款',
    nameEn: 'Social Hype',
    description: '更适合转发传播，文案和视觉更抓人。',
    descriptionEn: 'Made for attention, reposts, and conversation.',
    emoji: '⚡',
    accent: '#14b8a6',
    defaults: {
      channel: 'cursor',
      theme: 'brand-dark',
      backgroundType: 'none',
      backgroundValue: '',
      platform: 'twitter',
      metaphorCategory: 'shock',
      avatarType: 'emoji',
      avatarValue: '⚡',
      slogan: '别人发周报，我发战绩',
      modelBreakdown: [
        { name: 'Cursor', percentage: 44, color: '#6529c4' },
        { name: 'Claude', percentage: 34, color: '#d97706' },
        { name: 'GPT', percentage: 22, color: '#10b981' },
      ],
    },
  },
];
