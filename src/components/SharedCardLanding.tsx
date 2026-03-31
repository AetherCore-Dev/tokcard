import React, { useEffect, useMemo, useState } from 'react';
import CardRenderer from './CardRenderer';
import { buildCreateFromTemplateUrl, decodeSharedCardPayload, PLATFORMS, type DecodedSharedCard } from '@/lib/card';

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

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get('d');
    if (!encoded) {
      setStatus('invalid');
      return;
    }

    const decoded = decodeSharedCardPayload(encoded);
    if (!decoded) {
      setStatus('invalid');
      return;
    }

    setShared(decoded);
    setStatus('ready');
  }, []);

  const isZh = shared?.card.locale !== 'en';
  const platformInfo = shared ? PLATFORMS[shared.card.platform] : PLATFORMS.wechat;
  const linkMeta = useMemo(() => (shared ? getLinkMeta(shared.targetUrl) : null), [shared]);
  const createUrl = useMemo(() => (
    shared ? buildCreateFromTemplateUrl(shared.card, window.location.origin) : '/create'
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
            {isZh ? '分享承接页' : 'Shared card'}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12 lg:items-center">
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
              {isZh ? `${shared.card.username || '这位开发者'} 的 AI 战绩卡` : `${shared.card.username || 'This builder'}'s AI card`}
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] md:text-lg leading-7 text-[#6b7280]">
              {isZh
                ? '先看这张卡，再决定去哪里。这样在微信里也能顺畅打开，同时保留原作者真正想让你访问的链接。'
                : 'See the card first, then continue to the creator’s real destination without breaking the share experience.'}
            </p>

            <div className="mt-7 rounded-[30px] border border-[#dbe4ff] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                {isZh ? '作者想带你去' : 'Creator destination'}
              </div>
              <div className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-[#1d1d1f]">
                {isZh ? `前往 ${linkMeta.host}` : `Open ${linkMeta.host}`}
              </div>

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

              <p className="mt-3 text-sm leading-6 text-[#6b7280]">
                {isZh
                  ? '如果微信内不能直接打开，先点上面的链接复制，再去浏览器里粘贴即可。'
                  : 'If the in-app browser blocks the destination, copy the link above and open it in your browser.'}
              </p>

              <a
                href={shared.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#0071e3] px-6 py-3.5 text-white font-semibold shadow-lg shadow-[#0071e3]/20"
              >
                {isZh ? '打开原作者链接' : 'Open creator link'}
              </a>
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
                className="rounded-full border border-[#dbe4ff] bg-white px-4 py-2.5 font-medium text-[#1d1d1f] shadow-sm hover:bg-[#f8fbff]"
              >
                {isZh ? '用同款模板生成我的' : 'Use this template'}
              </a>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '不打断原始目的' : 'Intent stays intact'}</div>
                <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                  {isZh ? '你看到的是完整卡片，但仍然可以一键前往作者真正想分享的主页、项目或 GitHub。' : 'You get the full card moment first, then jump to the exact profile, project, or GitHub link the creator meant to share.'}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#dbe4ff] bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-[#1d1d1f]">{isZh ? '喜欢这种表达方式？' : 'Like this format?'}</div>
                <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                  {isZh ? 'TokCard 把枯燥的 token 用量变成一张愿意被转发的内容卡。' : 'TokCard turns dry token stats into something worth sharing.'}
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
            <div className="mt-1 text-xs text-[#6b7280]">{isZh ? '保留你的链接，也带上你的传播入口。' : 'Keep your own destination, plus a share flow that brings new people in.'}</div>
          </div>
          <a
            href={createUrl}
            className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0071e3]/20"
          >
            {isZh ? '用同款模板做我的卡片' : 'Create mine from this template'}
          </a>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full bg-[#111827] px-4 py-2 text-xs font-medium text-white shadow-lg" role="status">
          {toastMessage}
        </div>
      )}
    </main>
  );
}
