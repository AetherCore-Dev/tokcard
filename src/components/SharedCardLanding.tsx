import React, { useEffect, useMemo, useState } from 'react';
import CardRenderer from './CardRenderer';
import {
  buildCreateFromTemplateUrl,
  canParticipateInRanking,
  decodeSharedCardPayload,
  formatProofDateRange,
  formatTokens,
  getProofSourceLabel,
  getRankingSignalDescription,
  getRankingSignalLabel,
  getTrustTierDescription,
  getTrustTierLabel,
  PLATFORMS,
  type DecodedSharedCard,
} from '@/lib/card';
import { getAchievements } from '@/lib/achievements';
import { fetchShareMetrics, getMetricsIdFromPayload, trackShareMetric, type ShareMetrics } from '@/lib/metrics';
import { getRankTier } from '@/lib/titles';

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

function getSharePostureCopy(trustTier: DecodedSharedCard['card']['trustTier']) {
  switch (trustTier) {
    case 'screenshot-backed':
      return {
        badge: 'Proof-aware',
        badgeZh: '可信传播型',
        title: 'This card is meant to travel with proof attached.',
        titleZh: '这张卡更像“带证明一起传播”的分享方式。',
        description: 'The creator is not only showing AI intensity, but also adding screenshot-backed context so the post feels stronger and more believable.',
        descriptionZh: '作者不只是想晒 AI 强度，也在用截图佐证补可信度，让这条分享既有排面也更站得住。',
        readerTip: 'Read it as a builder flex with lightweight evidence, not a random boast.',
        readerTipZh: '更适合把它理解成“有轻量证据支撑的 builder 分享”，而不是随手吹一波。',
      };
    case 'usage-imported':
    case 'strong-authenticated':
      return {
        badge: 'Credible builder mode',
        badgeZh: '技术可信型',
        title: 'This card leans toward a more credible builder profile.',
        titleZh: '这张卡更偏“技术可信的 builder 名片”。',
        description: 'The creator is framing the post more like a usage-backed profile with stronger comparison value, rather than pure viral flexing.',
        descriptionZh: '作者更像是在把这条内容做成一张有数据依据的 builder profile，而不是纯粹为了爆款炫耀。',
        readerTip: 'Read it as a stronger signal of real workflow intensity and project seriousness.',
        readerTipZh: '更适合把它当成真实工作流强度和项目认真度的信号。',
      };
    default:
      return {
        badge: 'Viral-first',
        badgeZh: '先传播型',
        title: 'This card is primarily optimized to spread first.',
        titleZh: '这张卡当前更偏“先传播、先建立印象”。',
        description: 'The creator is packaging their AI usage into a social-ready builder card first, then adding stronger proof later if needed.',
        descriptionZh: '作者当前更像是在把 AI 使用强度先整理成一张适合转发的 builder 卡片，后续如果需要再补更强证明。',
        readerTip: 'Treat the ranking language here as a tier signal, not a formal leaderboard claim.',
        readerTipZh: '这里的档位表达更适合当作“强弱信号”，而不是正式榜单名次。',
      };
  }
}

export default function SharedCardLanding() {
  const [shared, setShared] = useState<DecodedSharedCard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [referralFromQuery, setReferralFromQuery] = useState('');
  const [origin, setOrigin] = useState('');
  const [encodedPayload, setEncodedPayload] = useState('');
  const [metricsId, setMetricsId] = useState('');
  const [metrics, setMetrics] = useState<ShareMetrics | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);

    // Try server-injected data first (from /u/abc123 short URL)
    const serverData = (window as unknown as { __TOKCARD_DATA__?: Record<string, unknown> }).__TOKCARD_DATA__;
    if (serverData && typeof serverData === 'object') {
      // Re-encode to base64url so decodeSharedCardPayload can parse it
      const jsonStr = JSON.stringify(serverData);
      const bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const base64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

      const decoded = decodeSharedCardPayload(base64url);
      if (decoded) {
        setEncodedPayload(base64url);
        setShared(decoded);
        setReferralFromQuery(String(serverData.ref || decoded.referralCode || ''));
        setStatus('ready');
        return;
      }
    }

    // Fallback: legacy ?d= base64 URL parameter
    const searchParams = new URLSearchParams(window.location.search);
    const encoded = searchParams.get('d');
    if (!encoded) {
      setStatus('invalid');
      return;
    }

    const decoded = decodeSharedCardPayload(encoded);
    if (!decoded) {
      setStatus('invalid');
      return;
    }

    setEncodedPayload(encoded);
    setShared(decoded);
    setReferralFromQuery(searchParams.get('ref') || decoded.referralCode || '');
    setStatus('ready');
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

  const isZh = shared?.card.locale !== 'en';
  const platformInfo = shared ? PLATFORMS[shared.card.platform] : PLATFORMS.wechat;
  const linkMeta = useMemo(() => (shared ? getLinkMeta(shared.targetUrl) : null), [shared]);
  const rankTier = useMemo(() => (shared ? getRankTier(shared.card.totalTokens) : null), [shared]);
  const achievements = useMemo(() => (shared ? getAchievements(shared.card) : []), [shared]);
  const featuredProjects = useMemo(
    () => shared?.card.projects.filter((project) => project.name && project.url) ?? [],
    [shared]
  );
  const leadingModel = useMemo(
    () => shared?.card.modelBreakdown.slice().sort((a, b) => b.percentage - a.percentage)[0] ?? null,
    [shared]
  );
  const createUrl = useMemo(() => (
    shared && origin ? buildCreateFromTemplateUrl(shared.card, origin) : '/create'
  ), [origin, shared]);
  const trustLabel = useMemo(() => (shared ? getTrustTierLabel(shared.card.trustTier, shared.card.locale) : ''), [shared]);
  const trustDescription = useMemo(() => (shared ? getTrustTierDescription(shared.card.trustTier, shared.card.locale) : ''), [shared]);
  const proofSourceLabel = useMemo(() => (
    shared && shared.card.proofSource ? getProofSourceLabel(shared.card.proofSource, shared.card.locale) : ''
  ), [shared]);
  const proofRangeLabel = useMemo(() => (shared ? formatProofDateRange(shared.card.proofDateRange, shared.card.locale) : ''), [shared]);
  const rankingEligible = useMemo(() => (shared ? canParticipateInRanking(shared.card.trustTier) : false), [shared]);
  const rankingSignalLabel = useMemo(() => (
    shared && rankTier ? getRankingSignalLabel(rankTier, shared.card.trustTier, shared.card.locale) : ''
  ), [rankTier, shared]);
  const rankingSignalDescription = useMemo(() => (
    shared && rankTier ? getRankingSignalDescription(rankTier, shared.card.trustTier, shared.card.locale) : ''
  ), [rankTier, shared]);
  const sharePosture = useMemo(() => (
    shared ? getSharePostureCopy(shared.card.trustTier) : null
  ), [shared]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2200);
  };

  const handleCopyLink = async () => {
    if (!shared) return;

    try {
      await navigator.clipboard.writeText(shared.targetUrl);
      showToast(isZh ? '链接已复制，可在浏览器中打开' : 'Link copied. Open it in your browser if needed.');
    } catch {
      showToast(isZh ? '复制失败，请手动复制' : 'Copy failed. Please copy it manually.');
    }
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,113,227,0.10),_transparent_36%),#f6f8ff] text-[#1d1d1f] px-4 py-6 md:px-6 md:py-8 pb-32 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4 text-sm">
          <a href="/" className="text-xl font-semibold tracking-tight text-[#1d1d1f]">TokCard</a>
          <div className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-xs font-medium text-[#64748b] shadow-sm">
            {isZh ? '分享增长页' : 'Share growth page'}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12 lg:items-start">
          <section className="flex justify-center lg:justify-start">
            <div className="w-full max-w-[380px] rounded-[36px] bg-white/70 p-3 shadow-[0_30px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <div className="flex justify-center overflow-hidden rounded-[30px] bg-[#eef2ff] px-3 py-4">
                <CardRenderer data={shared.card} scale={0.66} renderId="shared-card-preview" />
              </div>
            </div>
          </section>

          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-xs font-medium text-[#64748b] shadow-sm">
              <span>{isZh ? '你刚扫开了一张 TokCard' : 'You just opened a TokCard'}</span>
              <span className="text-[#cbd5e1]">·</span>
              <span>{isZh ? platformInfo.labelZh : platformInfo.label}</span>
            </div>

            <h1 className="mt-5 text-[2rem] md:text-5xl font-semibold tracking-tight leading-[1.06] text-[#1d1d1f]">
              {isZh ? `${shared.card.username || '这位开发者'} 的 AI 战绩名片` : `${shared.card.username || 'This builder'}'s AI card`}
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] md:text-lg leading-7 text-[#6b7280]">
              {isZh
                ? '这不是普通跳转页，而是一张先让你记住 TA、再带你进入 TA 项目和主页的分享入口。'
                : 'This is not just a redirect page. It is a share surface that helps you remember the builder before you continue to their real destination.'}
            </p>

            {rankTier && (
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <div className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 font-medium text-[#1d1d1f] shadow-sm">
                  {rankTier.badge} {isZh ? rankTier.clubLabel : rankTier.clubLabelEn}
                </div>
                <div className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 font-medium text-[#64748b] shadow-sm">
                  {rankingSignalLabel}
                </div>
                <div className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2 font-medium text-[#64748b] shadow-sm">
                  {formatTokens(shared.card.totalTokens)} tokens
                </div>
                <div className="rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-4 py-2 font-medium text-[#334155] shadow-sm">
                  {trustLabel}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '可信来源说明' : 'Trust and source'}</div>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">{trustDescription}</p>
                </div>
                <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#334155] md:max-w-[280px]">
                  <div className="font-semibold text-[#1d1d1f]">{trustLabel}</div>
                  <div className="mt-1 text-xs leading-5 text-[#64748b]">
                    {rankingEligible
                      ? rankingSignalDescription
                      : (isZh ? '当前更适合先分享和展示身份，后续再补截图或导入。' : 'This card is optimized for easy sharing first, with proof or imports added later when needed.')}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {proofSourceLabel && (
                  <div className="rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1.5 font-medium text-[#334155]">
                    {isZh ? '来源' : 'Source'} · {proofSourceLabel}
                  </div>
                )}
                {proofRangeLabel && (
                  <div className="rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5 font-medium text-[#64748b]">
                    {isZh ? '周期' : 'Range'} · {proofRangeLabel}
                  </div>
                )}
                {shared.card.importedAt && (
                  <div className="rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5 font-medium text-[#64748b]">
                    {isZh ? '已记录' : 'Recorded'}
                  </div>
                )}
              </div>
            </div>

            {metrics && (
              <div className="mt-5 rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '这张卡的传播结果' : 'This card\'s share results'}</div>
                    <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                      {isZh
                        ? '每次打开、点击作者链接、或用同款模板创建，都会在这里累计。'
                        : 'Each visit, creator-link click, and template clone adds to this running total.'}
                    </p>
                  </div>
                  {metrics.lastUpdatedAt && (
                    <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-3 text-xs text-[#64748b] md:max-w-[220px]">
                      {isZh ? '最近更新' : 'Last updated'} · {new Date(metrics.lastUpdatedAt).toLocaleString(shared.card.locale === 'zh' ? 'zh-CN' : 'en-US')}
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-4 shadow-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '打开' : 'Views'}</div>
                    <div className="mt-2 text-2xl font-semibold text-[#0071e3]">{metrics.views}</div>
                    <div className="mt-1 text-xs text-[#64748b]">{isZh ? '有人打开过这张卡' : 'People opened this card'}</div>
                  </div>
                  <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-4 shadow-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '点击' : 'Clicks'}</div>
                    <div className="mt-2 text-2xl font-semibold text-[#10b981]">{metrics.clicks}</div>
                    <div className="mt-1 text-xs text-[#64748b]">{isZh ? '点进作者原始链接' : 'Clicked through to the creator link'}</div>
                  </div>
                  <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-4 shadow-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '同款' : 'Clones'}</div>
                    <div className="mt-2 text-2xl font-semibold text-[#f59e0b]">{metrics.clones}</div>
                    <div className="mt-1 text-xs text-[#64748b]">{isZh ? '有人继续做了同款卡片' : 'People used this card as a template'}</div>
                  </div>
                </div>
              </div>
            )}

            {sharePosture && (
              <div className="mt-5 rounded-[24px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '这张卡更像哪种分享姿态？' : 'What kind of share posture is this?'}</div>
                    <div className="mt-3 inline-flex items-center rounded-full border border-[#dbe4ff] bg-white px-3 py-1 text-xs font-semibold text-[#334155]">
                      {isZh ? sharePosture.badgeZh : sharePosture.badge}
                    </div>
                    <div className="mt-3 text-lg font-semibold leading-7 text-[#111827]">
                      {isZh ? sharePosture.titleZh : sharePosture.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                      {isZh ? sharePosture.descriptionZh : sharePosture.description}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-3 text-sm text-[#334155] md:max-w-[320px]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '访客理解方式' : 'How to read it'}</div>
                    <div className="mt-2 leading-6">{isZh ? sharePosture.readerTipZh : sharePosture.readerTip}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '当前档位' : 'Current tier'}</div>
                <div className="mt-2 text-xl font-semibold text-[#111827]">{rankTier?.badge} {isZh ? rankTier?.label : rankTier?.labelEn}</div>
                <div className="mt-1 text-sm text-[#6b7280]">{rankingSignalDescription || (isZh ? '这张卡第一眼就能建立强弱感。' : 'This establishes status at a glance.')}</div>
              </div>
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '主力模型' : 'Primary model'}</div>
                <div className="mt-2 text-xl font-semibold text-[#111827]">{leadingModel?.name ?? '—'}</div>
                <div className="mt-1 text-sm text-[#6b7280]">{leadingModel ? `${leadingModel.percentage}%` : (isZh ? '暂无数据' : 'No data')}</div>
              </div>
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '项目入口' : 'Project links'}</div>
                <div className="mt-2 text-xl font-semibold text-[#111827]">{featuredProjects.length}</div>
                <div className="mt-1 text-sm text-[#6b7280]">{isZh ? '这张卡能继续把流量带走。' : 'This card keeps traffic moving forward.'}</div>
              </div>
            </div>

            <div className="mt-7 rounded-[30px] border border-[#dbe4ff] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                {isZh ? '作者想带你去' : 'Creator destination'}
              </div>
              <div className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-[#1d1d1f]">
                {isZh ? `前往 ${linkMeta.host}` : `Open ${linkMeta.host}`}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#6b7280]">
                {isZh
                  ? '你可以先感受这张卡的表达，再一键去作者真正想让你访问的主页、项目或 GitHub。'
                  : 'You can absorb the card first, then continue to the exact profile, project, or GitHub destination the creator wanted to share.'}
              </p>

              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-4 w-full rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-left text-sm leading-6 text-[#475569] break-all transition hover:bg-[#f1f7ff]"
              >
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                  {isZh ? '点这里复制备用链接' : 'Tap to copy backup link'}
                </span>
                <span className="mt-1 block">{linkMeta.display}</span>
              </button>

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <a
                  href={shared.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    void handleTrackMetric('share:click_destination');
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[#0071e3] px-6 py-3.5 text-white font-semibold shadow-lg shadow-[#0071e3]/20"
                >
                  {isZh ? '打开原作者链接' : 'Open creator link'}
                </a>
                <a
                  href={createUrl}
                  onClick={() => {
                    void handleTrackMetric('share:clone');
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-[#c7ddff] bg-[linear-gradient(135deg,#eef5ff_0%,#ffffff_100%)] px-6 py-3.5 font-semibold text-[#0f172a] shadow-sm shadow-[#0071e3]/10 hover:border-[#0071e3]"
                >
                  {isZh ? '做一张同款卡片' : 'Make one like this'}
                </a>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                onClick={handleShareCard}
                className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2.5 font-medium text-[#1d1d1f] shadow-sm hover:bg-[#f8fbff]"
              >
                {isZh ? '转发这张 TokCard' : 'Share this TokCard'}
              </button>
              <a
                href={createUrl}
                onClick={() => {
                  void handleTrackMetric('share:clone');
                }}
                className="rounded-full border border-[#c7ddff] bg-[linear-gradient(135deg,#eef5ff_0%,#ffffff_100%)] px-4 py-2.5 font-semibold text-[#0f172a] shadow-sm shadow-[#0071e3]/10 hover:border-[#0071e3]"
              >
                {isZh ? '用同款模板生成我的' : 'Use this template'}
              </a>
            </div>

            {referralFromQuery && (
              <div className="mt-5 rounded-[24px] border border-[#dbe4ff] bg-[#f8fbff] p-5 shadow-sm">
                <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '传播来源' : 'Referral source'}</div>
                <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                  {isZh ? `你是通过 @${referralFromQuery} 的传播链路来到这里的。` : `You arrived through @${referralFromQuery}'s share link.`}
                </p>
              </div>
            )}

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

            {featuredProjects.length > 0 && (
              <div className="mt-6 rounded-[28px] border border-[#dbe4ff] bg-white p-6 shadow-sm">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? '项目发现区' : 'Project discovery'}</div>
                    <div className="mt-2 text-xl font-semibold text-[#111827]">{isZh ? '这张卡还会把你带去这些项目' : 'This card can also lead you here'}</div>
                  </div>
                  <div className="text-xs text-[#64748b]">{featuredProjects.length} {isZh ? '个入口' : 'links'}</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
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

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '为什么这种表达更容易传播？' : 'Why does this format travel better?'}</div>
                <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                  {isZh ? '因为它先传递“这个人很能打”的信号，再自然带出项目和链接，社交注意力不会直接流失。' : 'Because it first signals capability, then naturally carries the viewer toward projects and links without losing attention.'}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '你也可以复制这条链路' : 'You can copy this share loop too'}</div>
                <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                  {isZh ? '做一张自己的 TokCard，把 token、项目和分享入口合并成一条完整的个人传播链路。' : 'Make your own TokCard to combine token stats, project links, and a repeatable share entry point.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 rounded-[24px] border border-[#dbe4ff] bg-white/95 px-4 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl md:px-5">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '喜欢这张卡？去做你的 TokCard' : 'Like this card? Make your own TokCard'}</div>
            <div className="mt-1 text-xs text-[#6b7280]">{isZh ? '保留你的链接，也带上你的传播入口和项目名片。' : 'Keep your own destination, plus a share flow and project card that brings people in.'}</div>
          </div>
          <a
            href={createUrl}
            onClick={() => {
              void handleTrackMetric('share:clone');
            }}
            className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0071e3]/20"
          >
            {isZh ? '用同款模板做我的卡片' : 'Create mine from this template'}
          </a>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full border border-white/20 bg-[#0f172a]/92 px-4 py-2 text-xs font-medium text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl" role="status">
          {toastMessage}
        </div>
      )}
    </main>
  );
}
