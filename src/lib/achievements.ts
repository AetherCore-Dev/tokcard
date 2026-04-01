import type { CardData, ModelBreakdown } from '@/lib/card';

export interface AchievementInfo {
  id: string;
  icon: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  tone: 'gold' | 'violet' | 'green' | 'blue' | 'neutral';
}

function getSortedBreakdown(modelBreakdown: ModelBreakdown[]) {
  return [...modelBreakdown].sort((a, b) => b.percentage - a.percentage);
}

export function getGrowthPercentage(current: number, lastMonth: number): number {
  if (lastMonth <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - lastMonth) / lastMonth) * 100);
}

export function getTopModel(modelBreakdown: ModelBreakdown[]): ModelBreakdown | null {
  return getSortedBreakdown(modelBreakdown)[0] ?? null;
}

export function getAchievements(card: Pick<CardData, 'totalTokens' | 'lastMonthTokens' | 'modelBreakdown' | 'locale'>): AchievementInfo[] {
  const achievements: AchievementInfo[] = [];
  const sorted = getSortedBreakdown(card.modelBreakdown);
  const top = sorted[0];
  const topThree = sorted.slice(0, 3);
  const growth = getGrowthPercentage(card.totalTokens, card.lastMonthTokens);

  if (card.totalTokens >= 1_000_000_000) {
    achievements.push({
      id: 'billion-club',
      icon: '👑',
      label: '十亿俱乐部',
      labelEn: '1B+ Club',
      description: '月消耗突破十亿 token，压迫感直接拉满。',
      descriptionEn: 'Monthly usage broke through 1B tokens.',
      tone: 'gold',
    });
  } else if (card.totalTokens >= 100_000_000) {
    achievements.push({
      id: 'hundred-million-club',
      icon: '🏆',
      label: '亿级战神',
      labelEn: '100M Legend',
      description: '已经不是重度用户，是可被围观的量级。',
      descriptionEn: 'Heavy enough to feel legendary.',
      tone: 'violet',
    });
  } else if (card.totalTokens >= 10_000_000) {
    achievements.push({
      id: 'ten-million-club',
      icon: '🏅',
      label: '千万俱乐部',
      labelEn: '10M Club',
      description: 'Token 体量已经足够拿来晒。',
      descriptionEn: 'Strong enough to flex on social.',
      tone: 'blue',
    });
  }

  if (top?.name.toLowerCase().includes('claude') && top.percentage >= 60) {
    achievements.push({
      id: 'claude-loyalist',
      icon: '🟠',
      label: 'Claude 忠实用户',
      labelEn: 'Claude Loyalist',
      description: '主要火力都交给了 Claude。',
      descriptionEn: 'Most of the workload goes to Claude.',
      tone: 'gold',
    });
  }

  if (top?.name.toLowerCase().includes('gpt') && top.percentage >= 60) {
    achievements.push({
      id: 'gpt-commander',
      icon: '🟢',
      label: 'GPT 主驾位',
      labelEn: 'GPT Commander',
      description: 'OpenAI 是当前工作流的主力引擎。',
      descriptionEn: 'GPT drives the current workflow.',
      tone: 'green',
    });
  }

  if (topThree.length >= 3 && topThree.every((item) => item.percentage >= 20 && item.percentage <= 45)) {
    achievements.push({
      id: 'multi-model-master',
      icon: '🎛️',
      label: '多模型均衡大师',
      labelEn: 'Multi-Model Master',
      description: '三种模型都在稳定输出，不偏科。',
      descriptionEn: 'Three models are contributing in balance.',
      tone: 'blue',
    });
  }

  if (growth >= 50) {
    achievements.push({
      id: 'growth-sprinter',
      icon: '📈',
      label: '烧钱冲刺王',
      labelEn: 'Growth Sprinter',
      description: '相较上月，Token 使用量大幅冲高。',
      descriptionEn: 'Token usage jumped sharply versus last month.',
      tone: 'violet',
    });
  }

  if (!achievements.length) {
    achievements.push({
      id: 'steady-builder',
      icon: '🛠️',
      label: '稳定输出型',
      labelEn: 'Steady Builder',
      description: '还没到夸张级，但已经很能打。',
      descriptionEn: 'Not outrageous yet, but clearly shipping.',
      tone: 'neutral',
    });
  }

  return achievements.slice(0, 4);
}
