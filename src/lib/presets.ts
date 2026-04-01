import type { CardData } from '@/lib/card';

export interface CardPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  defaults: Partial<CardData>;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'claude-heavy',
    name: 'Claude 重度用户',
    description: '高压排面，适合展示深度工作流。',
    emoji: '🟠',
    defaults: {
      channel: 'claude',
      theme: 'brand-dark',
      metaphorCategory: 'flex',
      avatarType: 'emoji',
      avatarValue: '🟠',
      slogan: '不是总结，是压迫感',
      modelBreakdown: [
        { name: 'Claude', percentage: 70, color: '#d97706' },
        { name: 'GPT', percentage: 20, color: '#10b981' },
        { name: 'Cursor', percentage: 10, color: '#6529c4' },
      ],
    },
  },
  {
    id: 'cursor-warrior',
    name: 'Cursor 编码战神',
    description: '代码型表达，更适合极客圈分享。',
    emoji: '🟣',
    defaults: {
      channel: 'cursor',
      theme: 'terminal-green',
      metaphorCategory: 'worker',
      avatarType: 'emoji',
      avatarValue: '💻',
      slogan: 'Build fast, review later',
      modelBreakdown: [
        { name: 'Cursor', percentage: 58, color: '#6529c4' },
        { name: 'Claude', percentage: 24, color: '#d97706' },
        { name: 'GPT', percentage: 18, color: '#10b981' },
      ],
    },
  },
  {
    id: 'viral-flex',
    name: '社交爆款款',
    description: '适合朋友圈和小红书，强调记忆点。',
    emoji: '🔥',
    defaults: {
      channel: 'gpt',
      theme: 'gradient-dream',
      metaphorCategory: 'meme',
      avatarType: 'emoji',
      avatarValue: '🔥',
      slogan: '别人晒腹肌，我晒 token',
      platform: 'xiaohongshu',
      modelBreakdown: [
        { name: 'GPT', percentage: 50, color: '#10b981' },
        { name: 'Claude', percentage: 30, color: '#d97706' },
        { name: 'Gemini', percentage: 20, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'linkedin-builder',
    name: '作品名片款',
    description: '适合作为个人项目名片和商务展示。',
    emoji: '🧠',
    defaults: {
      channel: 'gpt',
      theme: 'minimal-gray',
      metaphorCategory: 'flex',
      avatarType: 'emoji',
      avatarValue: '🧠',
      slogan: 'Shipping AI products with intent',
      platform: 'linkedin',
      modelBreakdown: [
        { name: 'GPT', percentage: 40, color: '#10b981' },
        { name: 'Claude', percentage: 35, color: '#d97706' },
        { name: 'Gemini', percentage: 25, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'cyber-showoff',
    name: '赛博炫技款',
    description: '视觉更猛，适合强调实验感。',
    emoji: '⚡',
    defaults: {
      channel: 'deepseek',
      theme: 'cyberpunk-neon',
      metaphorCategory: 'scifi',
      avatarType: 'emoji',
      avatarValue: '⚡',
      slogan: 'AI 是同事，效率是副产品',
      platform: 'twitter',
      modelBreakdown: [
        { name: 'DeepSeek', percentage: 46, color: '#1652f0' },
        { name: 'Claude', percentage: 32, color: '#d97706' },
        { name: 'GPT', percentage: 22, color: '#10b981' },
      ],
    },
  },
];
