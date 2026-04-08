import React, { useEffect, useMemo, useState } from 'react';
import CardRenderer from './CardRenderer';
import {
  buildCreateFromTemplateUrl,
  decodeSharedCardPayload,
  formatTokens,
  type DecodedSharedCard,
} from '@/lib/card';
import { getAchievements } from '@/lib/achievements';
import { fetchShareMetrics, getMetricsIdFromPayload, trackShareMetric, type ShareMetrics } from '@/lib/metrics';
import { getRegionLabel } from '@/lib/leaderboard';
import { getRankTier } from '@/lib/titles';

interface RankSummary {
  globalRank: number;
  totalCards: number;
  channelRank: number | null;
  regionRank: number | null;
  percentile: number;
}

function encodeStoredPayload(value: Record<string, unknown>): string {
  const jsonStr = JSON.stringify(value);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeStoredPayload(value: Record<string, unknown>) {
  const encoded = encodeStoredPayload(value);
  const decoded = decodeSharedCardPayload(encoded);
  return decoded ? { encoded, decoded } : null;
}

function getLinkMeta(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname.replace(/^www\./, ''),
      display: `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`,
    };
  } catch {
    return {
      host: url,
      display: url,
    };
  }
}

export default function SharedCardLanding() {
  const [shared, setShared] = useState<DecodedSharedCard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [encodedPayload, setEncodedPayload] = useState('');
  const [metricsId, setMetricsId] = useState('');
  const [metrics, setMetrics] = useState<ShareMetrics | null>(null);
  const [cardId, setCardId] = useState('');
  const [rankSummary, setRankSummary] = useState<RankSummary | null>(null);
  const [cardScale, setCardScale] = useState(0.66);

  useEffect(() => {
    let cancelled = false;
    setOrigin(window.location.origin);

    const hydrateSharedCard = (payload: Record<string, unknown>) => {
      const hydrated = decodeStoredPayload(payload);
      if (!hydrated) return false;

      const maybeId = typeof payload._id === 'string' ? payload._id : '';
      if (maybeId) {
        setCardId(maybeId.toLowerCase());
      }
      setEncodedPayload(hydrated.encoded);
      setShared(hydrated.decoded);
      setStatus('ready');
      return true;
    };

    // Try server-injected data first (from /u/abc123 short URL)
    const serverData = (window as unknown as { __TOKCARD_DATA__?: Record<string, unknown> }).__TOKCARD_DATA__;
    if (serverData && typeof serverData === 'object' && hydrateSharedCard(serverData)) {
      return () => {
        cancelled = true;
      };
    }

    // Legacy support: /u?d=<base64>
    const searchParams = new URLSearchParams(window.location.search);
    const encoded = searchParams.get('d');
    if (encoded) {
      const decoded = decodeSharedCardPayload(encoded);
      if (decoded) {
        setEncodedPayload(encoded);
        setShared(decoded);
        setStatus('ready');
        return () => {
          cancelled = true;
        };
      }
    }

    const pathMatch = window.location.pathname.match(/^\/u\/([a-z0-9]{4,16})$/i);
    const pathCardId = pathMatch?.[1]?.toLowerCase();
    if (pathCardId) {
      setCardId(pathCardId);
      void fetch(`/api/cards?id=${pathCardId}`)
        .then(async (res) => {
          if (!res.ok) return null;
          return res.json() as Promise<Record<string, unknown>>;
        })
        .then((payload) => {
          if (cancelled) return;
          if (payload && hydrateSharedCard(payload)) {
            return;
          }
          setStatus('invalid');
        })
        .catch(() => {
          if (!cancelled) {
            setStatus('invalid');
          }
        });

      return () => {
        cancelled = true;
      };
    }

    setStatus('invalid');
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!encodedPayload) {
      setMetricsId('');
      return;
    }

    void getMetricsIdFromPayload(encodedPayload).then((nextMetricsId) => {
      if (!cancelled) {
        setMetricsId(nextMetricsId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [encodedPayload]);

  useEffect(() => {
    let cancelled = false;

    if (!shared || !metricsId || !encodedPayload) {
      return;
    }

    const trackedKey = `tokcard:tracked-view:${metricsId}`;
    let alreadyTracked = false;

    try {
      alreadyTracked = window.sessionStorage.getItem(trackedKey) === '1';
    } catch {
      alreadyTracked = false;
    }

    if (alreadyTracked) {
      void fetchShareMetrics(metricsId).then((existingMetrics) => {
        if (!cancelled && existingMetrics) {
          setMetrics(existingMetrics);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    void trackShareMetric({
      event: 'share:view',
      metricsId,
      payload: encodedPayload,
      metadata: {
        trustTier: shared.card.trustTier,
        username: shared.card.username,
        platform: shared.card.platform,
      },
    }).then(async (currentMetrics) => {
      if (cancelled) {
        return;
      }

      if (currentMetrics) {
        try {
          window.sessionStorage.setItem(trackedKey, '1');
        } catch {
          // ignore session storage failures and keep metrics display working
        }
        setMetrics(currentMetrics);
        return;
      }

      const existingMetrics = await fetchShareMetrics(metricsId);
      if (!cancelled && existingMetrics) {
        setMetrics(existingMetrics);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [encodedPayload, metricsId, shared]);

  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.min(380, viewportWidth - 56);
      const nextScale = Math.min(0.75, maxWidth / 540);
      setCardScale(Math.max(0.54, nextScale));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!cardId) {
      setRankSummary(null);
      return;
    }

    void fetch(`/api/rank?id=${cardId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<RankSummary>;
      })
      .then((payload) => {
        if (!cancelled) {
          setRankSummary(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRankSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const isZh = shared?.card.locale !== 'en';
  const linkMeta = useMemo(() => (shared ? getLinkMeta(shared.targetUrl) : null), [shared]);
  const rankTier = useMemo(() => (shared ? getRankTier(shared.card.totalTokens) : null), [shared]);
  const achievements = useMemo(() => (shared ? getAchievements(shared.card) : []), [shared]);
  const featuredProjects = useMemo(
    () => shared?.card.projects.filter((project) => project.name && project.url) ?? [],
    [shared]
  );
  const createUrl = useMemo(() => (
    shared && origin ? buildCreateFromTemplateUrl(shared.card, origin) : '/create'
  ), [origin, shared]);
  const topProject = featuredProjects[0];
  const rankUrl = cardId ? `/rank?focus=${cardId}` : '/rank';
  const companyRankUrl = shared?.card.company ? `/rank?company=${encodeURIComponent(shared.card.company)}` : '';
  const regionRankUrl = shared?.card.region ? `/rank?region=${encodeURIComponent(shared.card.region)}` : '';

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2200);
  };

  const handleShareCard = async () => {
    const currentUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: isZh ? 'TokCard 分享卡片' : 'Shared TokCard',
          text: isZh ? '这张 AI 战绩卡还挺能打。' : 'This AI card is worth sharing.',
          url: currentUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(currentUrl);
      showToast(isZh ? '当前卡片链接已复制' : 'This card link is copied');
    } catch {
      showToast(isZh ? '分享失败，请稍后重试' : 'Share failed. Please try again.');
    }
  };

  const handleTrackMetric = async (event: 'share:click_destination' | 'share:clone') => {
    if (!shared || !metricsId || !encodedPayload) {
      return;
    }

    const currentMetrics = await trackShareMetric({
      event,
      metricsId,
      payload: encodedPayload,
      metadata: {
        trustTier: shared.card.trustTier,
        username: shared.card.username,
        platform: shared.card.platform,
      },
    });

    if (currentMetrics) {
      setMetrics(currentMetrics);
    }
  };

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-[#f6f8ff] text-[#1d1d1f] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">Loading shared TokCard…</div>
          <p className="mt-3 text-sm text-[#6b7280]">Preparing the shared card.</p>
        </div>
      </main>
    );
  }

  if (status === 'invalid' || !shared || !linkMeta) {
    return (
      <main className="min-h-screen bg-[#f6f8ff] text-[#1d1d1f] flex items-center justify-center px-6">
        <div className="max-w-lg rounded-[32px] border border-[#dbe4ff] bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] text-center">
          <div className="text-3xl font-semibold tracking-tight">{isZh ? '这张卡片链接已失效' : 'This shared card link is invalid'}</div>
          <p className="mt-4 text-sm leading-6 text-[#6b7280]">
            {isZh ? '你仍然可以生成一张属于自己的 TokCard。' : 'You can still generate your own TokCard.'}
          </p>
          <a
            href="/create"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0071e3] px-6 py-3 text-white font-semibold shadow-lg shadow-[#0071e3]/20"
          >
            {isZh ? '立即生成我的卡片' : 'Create my TokCard'}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,113,227,0.10),_transparent_36%),#f6f8ff] text-[#1d1d1f] px-4 py-6 md:px-6 md:py-8 pb-28">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4 text-sm">
          <a href="/" className="text-xl font-semibold tracking-tight text-[#1d1d1f]">TokCard</a>
          <button
            type="button"
            onClick={handleShareCard}
            className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-xs font-medium text-[#64748b] shadow-sm hover:bg-[#f8fbff]"
          >
            {isZh ? '转发' : 'Share'}
          </button>
        </div>

        {/* 1. Card preview */}
        <section className="flex justify-center">
          <div className="w-full max-w-[380px] rounded-[36px] bg-white/70 p-3 shadow-[0_30px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div className="flex justify-center overflow-hidden rounded-[30px] bg-[#eef2ff] px-3 py-4">
              <CardRenderer data={shared.card} scale={cardScale} renderId="shared-card-preview" />
            </div>
          </div>
        </section>

        {/* 2. One-line summary */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-[#6b7280]">
          <span className="font-semibold text-[#1d1d1f]">@{shared.card.username || (isZh ? '开发者' : 'builder')}</span>
          <span>{isZh ? '的 AI 战绩' : "'s AI stats"}</span>
          <span className="text-[#cbd5e1]">·</span>
          <span>{formatTokens(shared.card.totalTokens)} tokens</span>
          {rankTier && (
            <>
              <span className="text-[#cbd5e1]">·</span>
              <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-3 py-0.5 text-xs font-medium text-[#334155] shadow-sm">
                {rankTier.badge} {isZh ? rankTier.clubLabel : rankTier.clubLabelEn}
              </span>
            </>
          )}
        </div>

        {rankSummary && (
          <div className="mt-5 rounded-[28px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '排名位置' : 'Ranking snapshot'}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricPill label={isZh ? '全球' : 'Global'} value={`#${rankSummary.globalRank}`} />
              <MetricPill label={isZh ? '同渠道' : 'Channel'} value={rankSummary.channelRank ? `#${rankSummary.channelRank}` : '-'} />
              <MetricPill label={isZh ? '同地区' : 'Region'} value={rankSummary.regionRank ? `#${rankSummary.regionRank}` : '-'} />
              <MetricPill label={isZh ? '百分位' : 'Percentile'} value={`Top ${rankSummary.percentile}%`} />
            </div>
            {(shared.card.company || shared.card.region) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {shared.card.company && companyRankUrl && (
                  <a href={companyRankUrl} className="inline-flex min-h-10 items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-4 text-sm font-medium text-[#334155] hover:border-[#0071e3]">
                    {isZh ? `查看 ${shared.card.company} 排行` : `See ${shared.card.company} ranking`}
                  </a>
                )}
                {shared.card.region && regionRankUrl && (
                  <a href={regionRankUrl} className="inline-flex min-h-10 items-center rounded-full border border-[#dbe4ff] bg-white px-4 text-sm font-medium text-[#475569] hover:border-[#0071e3]">
                    {isZh ? `查看 ${getRegionLabel(shared.card.region)} 地区排行` : `See ${getRegionLabel(shared.card.region)} ranking`}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Primary CTA */}
        <a
          href={createUrl}
          onClick={() => { void handleTrackMetric('share:clone'); }}
          className="mt-6 flex items-center justify-center w-full py-4 rounded-full bg-[#0071e3] text-white font-semibold text-lg shadow-[0_18px_40px_rgba(0,113,227,0.28)]"
        >
          {isZh ? '我也要做一张' : 'Make mine'}
        </a>

        {/* 4. Secondary CTA */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <a
            href={shared.targetUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => { void handleTrackMetric('share:click_destination'); }}
            className="flex items-center justify-center w-full py-3.5 rounded-full border border-[#c7ddff] bg-[linear-gradient(135deg,#eef5ff_0%,#ffffff_100%)] font-semibold text-[#0f172a] shadow-sm shadow-[#0071e3]/10 hover:border-[#0071e3]"
          >
            {isZh ? '打开作者链接' : 'Open creator link'}
          </a>
          <a
            href={rankUrl}
            className="flex items-center justify-center w-full py-3.5 rounded-full border border-[#dbe4ff] bg-white font-semibold text-[#0f172a] shadow-sm hover:border-[#0071e3]"
          >
            {isZh ? '查看他的排行' : 'See ranking'}
          </a>
        </div>

        {topProject && (
          <a
            href={topProject.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center w-full py-3.5 rounded-full border border-[#dbe4ff] bg-white font-semibold text-[#0f172a] shadow-sm hover:border-[#0071e3]"
          >
            {isZh ? `去看项目：${topProject.name}` : `Open project: ${topProject.name}`}
          </a>
        )}

        {/* 5. Projects section */}
        {featuredProjects.length > 0 && (
          <div id="projects" className="mt-6 rounded-[28px] border border-[#dbe4ff] bg-white p-6 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '项目发现区' : 'Project discovery'}</div>
                <div className="mt-2 text-xl font-semibold text-[#111827]">{isZh ? `看看 @${shared?.card.username} 在做什么` : `See what @${shared?.card.username} is building`}</div>
              </div>
              <div className="text-xs text-[#64748b]">{featuredProjects.length} {isZh ? '个入口' : 'links'}</div>
            </div>
            <div className="mt-4 grid gap-3">
              {featuredProjects.map((project) => (
                <a
                  key={project.id}
                  href={project.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4 transition hover:border-[#0071e3] hover:bg-white"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">
                      {project.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#111827]">{project.name}</div>
                      <div className="mt-1 text-xs text-[#64748b] break-all">{project.url}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 6. Simplified metrics */}
        {metrics && (
          <div className="mt-4 flex items-center gap-6 text-sm text-[#6b7280]">
            <span>{metrics.views} {isZh ? '次查看' : 'views'}</span>
            <span>{metrics.clicks} {isZh ? '次点击' : 'clicks'}</span>
            <span>{metrics.clones} {isZh ? '人做了同款' : 'clones'}</span>
          </div>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="mt-5">
            <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '这张卡解锁的成就' : 'Unlocked achievements'}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {achievements.map((achievement) => (
                <div key={achievement.id} className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-xs font-medium text-[#334155] shadow-sm">
                  {achievement.icon} {isZh ? achievement.label : achievement.labelEn}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7. Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-lg">
          <a
            href={createUrl}
            onClick={() => { void handleTrackMetric('share:clone'); }}
            className="flex items-center justify-center w-full py-4 rounded-full bg-[#0071e3] text-white font-semibold text-lg shadow-[0_18px_40px_rgba(0,113,227,0.28)]"
          >
            {isZh ? '我也要做一张' : 'Make mine'}
          </a>
          {metrics && metrics.clones > 0 && (
            <div className="mt-2 text-center text-xs text-[#6b7280]">
              {isZh ? `已有 ${metrics.clones} 人用了同款模板` : `${metrics.clones} people used this template`}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full border border-white/20 bg-[#0f172a]/92 px-4 py-2 text-xs font-medium text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl" role="status">
          {toastMessage}
        </div>
      )}
    </main>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[#111827]">{value}</div>
    </div>
  );
}
