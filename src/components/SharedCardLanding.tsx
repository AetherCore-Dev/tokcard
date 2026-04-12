import React, { useEffect, useMemo, useState } from 'react';
import CardRenderer from './CardRenderer';
import {
  buildCreateFromTemplateUrl,
  decodeSharedCardPayload,
  formatTokens,
  type DecodedSharedCard,
} from '@/lib/card';
import { getMetricsIdFromPayload, trackShareMetric } from '@/lib/metrics';
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

export default function SharedCardLanding() {
  const [shared, setShared] = useState<DecodedSharedCard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [encodedPayload, setEncodedPayload] = useState('');
  const [metricsId, setMetricsId] = useState('');
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
    if (!shared || !metricsId || !encodedPayload) {
      return;
    }

    const trackedKey = `tokcard:tracked-view:${metricsId}`;

    try {
      if (window.sessionStorage.getItem(trackedKey) === '1') {
        return;
      }
    } catch {
      // ignore session storage failures
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
    }).finally(() => {
      try {
        window.sessionStorage.setItem(trackedKey, '1');
      } catch {
        // ignore session storage failures
      }
    });
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

  const browserIsZh = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language);
  const isZh = shared ? shared.card.locale !== 'en' : browserIsZh;
  const rankTier = useMemo(() => (shared ? getRankTier(shared.card.totalTokens) : null), [shared]);
  const featuredProjects = useMemo(
    () => shared?.card.projects.filter((project) => project.name && project.url) ?? [],
    [shared]
  );
  const createUrl = useMemo(() => (
    shared && origin ? buildCreateFromTemplateUrl(shared.card, origin) : '/create'
  ), [origin, shared]);
  const topProject = featuredProjects[0];
  const rankUrl = cardId ? `/rank?focus=${cardId}` : '/rank';
  const primaryProjectName = shared?.card.primaryProjectName?.trim() || topProject?.name || (isZh ? '未命名项目' : 'Untitled project');
  const primaryProjectPitch = shared?.card.primaryProjectPitch?.trim() || shared?.card.slogan?.trim() || (isZh ? '这位开发者正在用 AI 推进一个项目。' : 'This builder is using AI to push a project forward.');
  const primaryProjectUrl = (shared?.card.primaryProjectUrl?.trim()) || topProject?.url || shared?.targetUrl || '';
  const secondaryProjects = featuredProjects.filter((project) => project.url !== primaryProjectUrl || project.name !== primaryProjectName).slice(0, 3);
  const projectHost = (() => {
    if (!primaryProjectUrl) return '';
    try {
      return new URL(primaryProjectUrl).hostname.replace(/^www\./, '');
    } catch {
      return primaryProjectUrl.replace(/^https?:\/\//, '').split('/')[0] || '';
    }
  })();

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

    await trackShareMetric({
      event,
      metricsId,
      payload: encodedPayload,
      metadata: {
        trustTier: shared.card.trustTier,
        username: shared.card.username,
        platform: shared.card.platform,
      },
    });
  };

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-[#f6f8ff] text-[#1d1d1f] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">{browserIsZh ? '加载中…' : 'Loading…'}</div>
          <p className="mt-3 text-sm text-[#6b7280]">{browserIsZh ? '正在准备卡片' : 'Preparing the shared card'}</p>
        </div>
      </main>
    );
  }

  if (status === 'invalid' || !shared) {
    return (
      <main className="min-h-screen bg-[#f6f8ff] text-[#1d1d1f] flex items-center justify-center px-6">
        <div className="max-w-lg rounded-[32px] border border-[#dbe4ff] bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] text-center">
          <div className="text-3xl font-semibold tracking-tight">{isZh ? '这张卡片链接已失效' : 'This shared card link is invalid'}</div>
          <p className="mt-4 text-sm leading-6 text-[#6b7280]">
            {isZh ? '你仍然可以生成一张属于自己的 TokCard。' : 'You can still generate your own TokCard.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-[#dbe4ff] bg-white px-6 py-3 text-[#1d1d1f] font-medium"
            >
              {isZh ? '返回首页' : 'Go to homepage'}
            </a>
            <a
              href="/create"
              className="inline-flex items-center justify-center rounded-full bg-[#0071e3] px-6 py-3 text-white font-semibold shadow-lg shadow-[#0071e3]/20"
            >
              {isZh ? '立即生成我的卡片' : 'Create my TokCard'}
            </a>
          </div>
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
          <div className="flex items-center gap-2">
            <a href="/" className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-xs font-medium text-[#64748b] shadow-sm hover:bg-[#f8fbff]">
              {isZh ? '首页' : 'Home'}
            </a>
            <button
              type="button"
              onClick={handleShareCard}
              className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-xs font-medium text-[#64748b] shadow-sm hover:bg-[#f8fbff]"
            >
              {isZh ? '转发' : 'Share'}
            </button>
          </div>
        </div>

        {/* 1. Card preview */}
        <section className="flex justify-center">
          <div className="w-full max-w-[380px] rounded-[36px] bg-white/70 p-3 shadow-[0_30px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div className="flex justify-center overflow-hidden rounded-[30px] bg-[#eef2ff] px-3 py-4">
              <CardRenderer data={shared.card} scale={cardScale} renderId="shared-card-preview" />
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#dbe4ff] bg-white/92 p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '这张卡先让你看到什么' : 'What this card leads with'}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">{isZh ? '先看 Token，再看项目，最后看排名。' : 'Token first, project second, rank third.'}</div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#475569]">
            <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1.5">🔥 {isZh ? 'Token 战绩' : 'Token proof'}</span>
            <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1.5">🧩 {isZh ? '项目入口' : 'Project story'}</span>
            <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1.5">🏆 {isZh ? '榜单证明' : 'Rank signal'}</span>
          </div>
        </section>

        {/* 2. Token -> Project -> Rank summary */}
        <section className="mt-5 grid gap-3">
          <div className="rounded-[28px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '1 · Token 战绩' : '1 · Token signal'}</div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold tracking-tight text-[#0f172a]">{formatTokens(shared.card.totalTokens)} tokens</div>
                <div className="mt-2 text-sm text-[#64748b]">
                  @{shared.card.username || (isZh ? '开发者' : 'builder')} {isZh ? '本月的 AI 消耗量。' : 'this month in AI usage.'}
                </div>
              </div>
              {rankTier && (
                <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-[#334155] shadow-sm">
                  {rankTier.badge} {isZh ? rankTier.clubLabel : rankTier.clubLabelEn}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '2 · 代表项目' : '2 · Signature project'}</div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-[#0f172a]">{primaryProjectName}</div>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">{primaryProjectPitch}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {projectHost && (
                <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1 text-xs font-medium text-[#475569]">
                  {projectHost}
                </span>
              )}
              {primaryProjectUrl && (
                <a
                  href={primaryProjectUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => { void handleTrackMetric('share:click_destination'); }}
                  className="inline-flex items-center rounded-full border border-[#c7ddff] bg-[linear-gradient(135deg,#eef5ff_0%,#ffffff_100%)] px-4 py-2 text-sm font-semibold text-[#0f172a] shadow-sm shadow-[#0071e3]/10 hover:border-[#0071e3]"
                >
                  {isZh ? '打开项目' : 'Open project'}
                </a>
              )}
            </div>
            {secondaryProjects.length > 0 && (
              <div id="projects" className="mt-4 flex flex-wrap gap-2">
                {secondaryProjects.map((project) => (
                  <a
                    key={project.id}
                    href={project.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => { void handleTrackMetric('share:click_destination'); }}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-2 text-xs font-medium text-[#334155] hover:border-[#0071e3] hover:bg-white"
                  >
                    <span>{project.icon}</span>
                    <span className="truncate">{project.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '3 · 榜单证明' : '3 · Rank proof'}</div>
            {rankSummary ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3">
                  <div className="text-xs text-[#94a3b8]">{isZh ? '全球名次' : 'Global rank'}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-[#0f172a]">#{rankSummary.globalRank}</div>
                </div>
                <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3">
                  <div className="text-xs text-[#94a3b8]">{isZh ? '超过用户' : 'Ahead of'}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-[#0f172a]">{Math.max(0, 100 - rankSummary.percentile)}%</div>
                </div>
                <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3">
                  <div className="text-xs text-[#94a3b8]">{isZh ? '当前档位' : 'Tier'}</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight text-[#0f172a]">{rankTier ? `${rankTier.badge} ${isZh ? rankTier.label : rankTier.labelEn}` : '--'}</div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#64748b]">
                {rankTier
                  ? (isZh ? '这张卡已经带上榜单信号。数据同步后，这里会显示更明确的全球位置和比较结果。' : 'This card already carries a leaderboard signal. Once the data syncs, this section will show a clearer global position.')
                  : (isZh ? '这张卡还没有进入可展示排名的状态，但项目和 Token 已经可以先被看到。' : 'This card does not show ranking yet, but the token and project can already do the talking.')}
              </p>
            )}
            <div className="mt-4">
              <a
                href={rankUrl}
                className="flex items-center justify-center w-full py-3.5 rounded-full border border-[#dbe4ff] bg-white font-semibold text-[#0f172a] shadow-sm hover:border-[#0071e3]"
              >
                {isZh ? '查看 Token 排名' : 'See token ranking'}
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* 7. Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-lg">
          <a
            href={createUrl}
            onClick={() => { void handleTrackMetric('share:clone'); }}
            className="flex items-center justify-center w-full py-4 rounded-full bg-[#0071e3] text-white font-semibold text-lg shadow-[0_18px_40px_rgba(0,113,227,0.28)]"
          >
            {isZh ? '做一张属于我的名片' : 'Make my card'}
          </a>
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
