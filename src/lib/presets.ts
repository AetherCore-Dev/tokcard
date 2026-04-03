import type { CardData } from '@/lib/card';

export interface CardPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  accent: string;
  defaults: Partial<CardData>;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'claude-heavy',
    name: 'Claude 重度用户',
    description: '高压排面，适合展示深度工作流。',
    emoji: '🟠',
    accent: '#d97706',
    defaults: {
      channel: 'claude',
      theme: 'brand-dark',
      platform: 'wechat',
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
    accent: '#22c55e',
    defaults: {
      channel: 'cursor',
      theme: 'terminal-green',
      platform: 'wechat',
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
    accent: '#ec4899',
    defaults: {
      channel: 'gpt',
      theme: 'gradient-dream',
      platform: 'xiaohongshu',
      metaphorCategory: 'meme',
      avatarType: 'emoji',
      avatarValue: '🔥',
      slogan: '别人晒腹肌，我晒 token',
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
    accent: '#6b7280',
    defaults: {
      channel: 'gpt',
      theme: 'minimal-gray',
      platform: 'linkedin',
      metaphorCategory: 'flex',
      avatarType: 'emoji',
      avatarValue: '🧠',
      slogan: 'Shipping AI products with intent',
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
    accent: '#06b6d4',
    defaults: {
      channel: 'deepseek',
      theme: 'cyberpunk-neon',
      platform: 'twitter',
      metaphorCategory: 'scifi',
      avatarType: 'emoji',
      avatarValue: '⚡',
      slogan: 'AI 是同事，效率是副产品',
      modelBreakdown: [
        { name: 'DeepSeek', percentage: 46, color: '#1652f0' },
        { name: 'Claude', percentage: 32, color: '#d97706' },
        { name: 'GPT', percentage: 22, color: '#10b981' },
      ],
    },
  },
  {
    id: 'gemini-explorer',
    name: 'Gemini 探索者',
    description: '多模型混用，适合全栈 AI 玩家。',
    emoji: '🌊',
    accent: '#3b82f6',
    defaults: {
      channel: 'gemini',
      theme: 'ocean-blue',
      platform: 'wechat',
      metaphorCategory: 'flex',
      avatarType: 'emoji',
      avatarValue: '🌊',
      slogan: '每个模型都是我的工具箱',
      modelBreakdown: [
        { name: 'Gemini', percentage: 38, color: '#ef4444' },
        { name: 'Claude', percentage: 34, color: '#d97706' },
        { name: 'GPT', percentage: 28, color: '#10b981' },
      ],
    },
  },
  {
    id: 'team-lead',
    name: '团队 Leader',
    description: '管理视角，展示团队 AI 协作效率。',
    emoji: '👑',
    accent: '#8b5cf6',
    defaults: {
      channel: 'claude',
      theme: 'bold-violet',
      platform: 'wechat',
      metaphorCategory: 'flex',
      avatarType: 'emoji',
      avatarValue: '👑',
      slogan: '带队用 AI，效率翻三倍',
      modelBreakdown: [
        { name: 'Claude', percentage: 45, color: '#d97706' },
        { name: 'GPT', percentage: 35, color: '#10b981' },
        { name: 'Cursor', percentage: 20, color: '#6529c4' },
      ],
    },
  },
  {
    id: 'indie-hacker',
    name: '独立开发者',
    description: '产品导向，适合展示个人作品集。',
    emoji: '🚀',
    accent: '#f97316',
    defaults: {
      channel: 'cursor',
      theme: 'sunset-warm',
      platform: 'twitter',
      metaphorCategory: 'worker',
      avatarType: 'emoji',
      avatarValue: '🚀',
      slogan: '一个人就是一支队伍',
      modelBreakdown: [
        { name: 'Cursor', percentage: 42, color: '#6529c4' },
        { name: 'Claude', percentage: 38, color: '#d97706' },
        { name: 'GPT', percentage: 20, color: '#10b981' },
      ],
    },
  },
];
