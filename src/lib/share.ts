import type { PlatformKey } from '@/lib/card';

export interface ShareIntent {
  title: string;
  text: string;
  url?: string;
  files?: File[];
}

export function detectShareEnvironment(userAgent: string): PlatformKey | 'native' {
  const ua = userAgent.toLowerCase();
  if (ua.includes('micromessenger')) return 'wechat';
  if (ua.includes('weibo')) return 'weibo';
  if (ua.includes('xiaohongshu')) return 'xiaohongshu';
  if (ua.includes('instagram')) return 'instagram';
  if (ua.includes('linkedin')) return 'linkedin';
  if (ua.includes('twitter') || ua.includes('x.com')) return 'twitter';
  return 'native';
}

export async function shareWithFallback(intent: ShareIntent): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(intent);
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
    }
  }

  const text = [intent.title, intent.text, intent.url].filter(Boolean).join('\n');
  await navigator.clipboard.writeText(text);
  return 'copied';
}
