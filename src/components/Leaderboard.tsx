import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ChannelFilter,
  type LeaderboardEntry,
  type LeaderboardFilters,
  type LeaderboardIndex,
  type TimeFilter,
  CHANNEL_FILTERS,
  CHANNEL_ICONS,
  FEATURED_REGIONS,
  RANK_TIER_BADGES,
  TIME_FILTERS,
  fetchLeaderboard,
  getRankMedal,
  getRegionFlag,
  getRegionLabel,
} from '@/lib/leaderboard';
import { formatTokens } from '@/lib/card';

const PAGE_SIZE = 20;

function normalizeCardId(value?: string): string {
  const normalized = (value || '').trim().toLowerCase();
  return /^[a-z0-9]{4,16}$/.test(normalized) ? normalized : '';
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [region, setRegion] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [time, setTime] = useState<TimeFilter>('all');
  const [highlightId, setHighlightId] = useState('');
  const [focusNotFound, setFocusNotFound] = useState(false);
  const [page, setPage] = useState<number | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const browserIsZh = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialChannel = params.get('channel') as ChannelFilter | null;
    const initialRegion = (params.get('region') || '').toUpperCase();
    const initialCompany = params.get('company') || '';
    const initialTime = params.get('time') as TimeFilter | null;
    const initialFocus = normalizeCardId(params.get('focus') || '');
    const initialPage = Number(params.get('page') || '');

    if (initialChannel && CHANNEL_FILTERS.some((item) => item.value === initialChannel)) {
      setChannel(initialChannel);
    }
    if (initialRegion) {
      setRegion(initialRegion);
    }
    if (initialCompany) {
      setCompanyInput(initialCompany);
      setCompanyFilter(initialCompany);
    }
    if (initialTime && TIME_FILTERS.some((item) => item.value === initialTime)) {
      setTime(initialTime);
    }
    if (initialFocus) {
      setHighlightId(initialFocus);
    }
    if (Number.isFinite(initialPage) && initialPage > 0) {
      setPage(Math.floor(initialPage));
    }
    setHasInitialized(true);
  }, []);

  useEffect(() => {
    if (!hasInitialized) return;

    const filters: LeaderboardFilters = {
      channel,
      region,
      company: companyFilter,
      time,
      page: page ?? undefined,
      limit: PAGE_SIZE,
      focus: highlightId || undefined,
    };

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchLeaderboard(filters)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channel, region, companyFilter, time, page, highlightId, hasInitialized]);

  useEffect(() => {
    if (!hasInitialized) return;

    const params = new URLSearchParams(window.location.search);

    if (channel !== 'all') params.set('channel', channel);
    else params.delete('channel');

    if (region) params.set('region', region);
    else params.delete('region');

    if (companyFilter.trim()) params.set('company', companyFilter.trim());
    else params.delete('company');

    if (time !== 'all') params.set('time', time);
    else params.delete('time');

    if (highlightId) params.set('focus', highlightId);
    else params.delete('focus');

    if (page && page > 1) params.set('page', String(page));
    else params.delete('page');

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [channel, region, companyFilter, time, highlightId, page, hasInitialized]);

  useEffect(() => {
    if (!highlightId || !data?.entries.length) {
      setFocusNotFound(false);
      return;
    }
    const node = document.querySelector(`[data-rank-id="${highlightId}"]`);
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFocusNotFound(false);
    } else {
      setFocusNotFound(true);
    }
  }, [data, highlightId]);

  const companySuggestions = data?.meta?.companySuggestions ?? [];
  const topCompanies = data?.meta?.topCompanies ?? [];
  const currentPage = data?.meta?.page ?? page ?? 1;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.meta?.limit ?? PAGE_SIZE))) : 1;
  const rangeStart = data && data.total > 0 ? (data.meta?.offset ?? 0) + 1 : 0;
  const rangeEnd = data ? (data.meta?.offset ?? 0) + data.entries.length : 0;
  const pageTitle = browserIsZh ? 'Token 排行榜' : 'Token Leaderboard';
  const pageSubtitle = data && data.total > 0
    ? (browserIsZh
      ? `${data.total} 位开发者符合当前筛选 · 当前显示 ${rangeStart}-${rangeEnd}`
      : `${data.total} builders match current filters · showing ${rangeStart}-${rangeEnd}`)
    : (browserIsZh ? '还没有符合条件的上榜者' : 'No builders match the current filters');

  const buildRankHref = useCallback((overrides: { region?: string; company?: string }) => {
    const params = new URLSearchParams();
    const nextChannel = channel;
    const nextRegion = overrides.region !== undefined ? overrides.region : region;
    const nextCompany = overrides.company !== undefined ? overrides.company : companyFilter;
    const nextTime = time;

    if (nextChannel && nextChannel !== 'all') params.set('channel', nextChannel);
    if (nextRegion) params.set('region', nextRegion);
    if (nextCompany.trim()) params.set('company', nextCompany.trim());
    if (nextTime !== 'all') params.set('time', nextTime);

    const query = params.toString();
    return `/rank${query ? `?${query}` : ''}`;
  }, [channel, companyFilter, region, time]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 pb-32">
      <div className="pt-6 pb-5 text-center">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{pageTitle}</h1>
        <p className="mt-2 text-sm text-[#6b7280]">{pageSubtitle}</p>
      </div>

      <div className="rounded-[28px] border border-[#dbe4ff] bg-white/90 p-4 md:p-5 shadow-sm backdrop-blur mb-5">
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {CHANNEL_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setPage(1);
                setHighlightId('');
                setChannel(f.value);
              }}
              className={`flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                channel === f.value
                  ? 'bg-[#0071e3] text-white shadow-md'
                  : 'bg-white border border-[#dbe4ff] text-[#64748b] hover:border-[#0071e3]'
              }`}
            >
              <span>{f.icon}</span>
              <span>{browserIsZh ? f.labelZh : f.labelEn}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_220px]">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? '地区 / 国家' : 'Region / Country'}</span>
            <select
              value={region}
              onChange={(e) => {
                setPage(1);
                setHighlightId('');
                setRegion(e.target.value);
              }}
              className="min-h-11 rounded-2xl border border-[#dbe4ff] bg-white px-4 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
            >
              {FEATURED_REGIONS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.flag} {browserIsZh ? item.label : item.labelEn}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? '公司 / 组织' : 'Company / Org'}</span>
            <div className="flex gap-2">
              <input
                list="leaderboard-company-suggestions"
                type="text"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    setHighlightId('');
                    setCompanyFilter(companyInput.trim());
                  }
                }}
                placeholder={browserIsZh ? '输入公司或组织名' : 'Search company or organization'}
                className="min-h-11 flex-1 rounded-2xl border border-[#dbe4ff] bg-white px-4 text-sm text-[#1d1d1f] placeholder-[#94a3b8] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
              />
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setHighlightId('');
                  setCompanyFilter(companyInput.trim());
                }}
                className="min-h-11 rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white"
              >
                {browserIsZh ? '应用' : 'Apply'}
              </button>
            </div>
            <datalist id="leaderboard-company-suggestions">
              {companySuggestions.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? '时间范围' : 'Time Range'}</span>
            <div className="grid grid-cols-3 gap-2">
              {TIME_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setHighlightId('');
                    setTime(item.value);
                  }}
                  className={`min-h-11 rounded-2xl px-3 text-sm font-medium transition-all ${
                    time === item.value
                      ? 'bg-[#0071e3] text-white shadow-md'
                      : 'border border-[#dbe4ff] bg-white text-[#64748b] hover:border-[#0071e3]'
                  }`}
                >
                  {browserIsZh ? item.labelZh : item.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(region || companyFilter || time !== 'all' || channel !== 'all') && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#64748b]">
              <span className="font-medium">{browserIsZh ? '当前筛选：' : 'Active filters:'}</span>
              {channel !== 'all' && <FilterChip label={`${browserIsZh ? '渠道' : 'Channel'} · ${browserIsZh ? CHANNEL_FILTERS.find((item) => item.value === channel)?.labelZh : CHANNEL_FILTERS.find((item) => item.value === channel)?.labelEn ?? channel}`} onClear={() => { setPage(1); setHighlightId(''); setChannel('all'); }} />}
              {region && <FilterChip label={`${browserIsZh ? '地区' : 'Region'} · ${getRegionLabel(region, browserIsZh)}`} onClear={() => { setPage(1); setHighlightId(''); setRegion(''); }} />}
              {companyFilter && <FilterChip label={`${browserIsZh ? '组织' : 'Org'} · ${companyFilter}`} onClear={() => { setPage(1); setHighlightId(''); setCompanyInput(''); setCompanyFilter(''); }} />}
              {time !== 'all' && <FilterChip label={`${browserIsZh ? '时间' : 'Time'} · ${browserIsZh ? TIME_FILTERS.find((item) => item.value === time)?.labelZh : TIME_FILTERS.find((item) => item.value === time)?.labelEn ?? time}`} onClear={() => { setPage(1); setHighlightId(''); setTime('all'); }} />}
            </div>
            <div className="mt-3 rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#475569]">
              {companyFilter
                ? (browserIsZh
                  ? `正在查看 ${companyFilter} 的成员榜单${region ? ` · ${getRegionLabel(region, true)}` : ''}`
                  : `Viewing builders from ${companyFilter}${region ? ` · ${getRegionLabel(region, false)}` : ''}`)
                : region
                  ? (browserIsZh ? `正在查看 ${getRegionLabel(region, true)} 的开发者榜单` : `Viewing builders in ${getRegionLabel(region, false)}`)
                  : (browserIsZh ? '当前榜单已按所选维度过滤' : 'The leaderboard is filtered by your current selections')}
            </div>
          </>
        )}
      </div>

      {topCompanies.length > 0 && (
        <div className="mb-5 rounded-[28px] border border-[#dbe4ff] bg-white p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? '热门组织' : 'Top organizations'}</div>
              <div className="mt-1 text-sm text-[#64748b]">{browserIsZh ? '看看哪些公司/组织在高强度使用 AI。' : 'See which organizations are using AI most aggressively.'}</div>
            </div>
            <div className="text-xs text-[#94a3b8]">{browserIsZh ? '按当前筛选计算' : 'Calculated from current filters'}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {topCompanies.map(({ name, count }) => (
              <a
                key={name}
                href={buildRankHref({ company: name })}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-4 text-sm font-medium text-[#334155] hover:border-[#0071e3] hover:bg-white"
              >
                <span>{name}</span>
                <span className="text-xs text-[#94a3b8]">{count} {browserIsZh ? '人' : 'people'}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {data && data.entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3 pb-24">
          {focusNotFound && highlightId && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {browserIsZh ? '该卡片不在当前筛选结果中，试试清除筛选条件' : 'This card is not in current filters. Try clearing filters.'}
            </div>
          )}
          {data?.entries.map((entry, index) => (
            <LeaderboardRow
              key={entry.id}
              entry={entry}
              rank={(data?.meta?.offset ?? 0) + index + 1}
              highlight={entry.id === highlightId}
              buildRankHref={buildRankHref}
              isZh={browserIsZh}
            />
          ))}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-[24px] border border-[#dbe4ff] bg-white p-4 shadow-sm">
          <div className="text-sm text-[#64748b]">
            {browserIsZh ? '第 ' : 'Page '}<span className="font-semibold text-[#111827]">{currentPage}</span>{browserIsZh ? ` / ${totalPages} 页` : ` / ${totalPages}`}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="min-h-10 rounded-full border border-[#dbe4ff] bg-white px-4 text-sm font-medium text-[#475569] disabled:opacity-40"
            >
              {browserIsZh ? '上一页' : 'Previous'}
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="min-h-10 rounded-full bg-[#111827] px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {browserIsZh ? '下一页' : 'Next'}
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pt-2 bg-gradient-to-t from-[#fbfbfd] via-[#fbfbfd] to-transparent" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <a
            href="/create"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-semibold text-lg bg-[#0071e3] text-white shadow-[0_18px_40px_rgba(0,113,227,0.28)] hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {browserIsZh ? '我也要上榜' : 'Create my card'}
          </a>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5"
    >
      <span>{label}</span>
      <span className="text-[#94a3b8]">×</span>
    </button>
  );
}

function LeaderboardRow({
  entry,
  rank,
  highlight,
  buildRankHref,
  isZh,
}: {
  entry: LeaderboardEntry;
  rank: number;
  highlight: boolean;
  buildRankHref: (overrides: { region?: string; company?: string }) => string;
  isZh: boolean;
}) {
  const tier = RANK_TIER_BADGES[entry.rankTierId] ?? RANK_TIER_BADGES.starter;
  const isTop3 = rank <= 3;

  return (
    <div
      data-rank-id={entry.id}
      className={`rounded-[24px] border p-4 transition-all ${
        highlight
          ? 'border-[#0071e3] bg-[#f8fbff] shadow-[0_12px_30px_rgba(0,113,227,0.12)]'
          : isTop3
            ? 'bg-white border-[#dbe4ff] shadow-[0_8px_24px_rgba(0,113,227,0.08)]'
            : 'bg-white/70 border-transparent hover:border-[#dbe4ff] hover:bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 text-center font-bold shrink-0 ${rank === 1 ? 'text-2xl' : rank <= 3 ? 'text-xl' : 'text-sm text-[#94a3b8]'}`}>
          {getRankMedal(rank)}
        </div>

        <div className="w-11 h-11 rounded-full bg-[#f1f5f9] flex items-center justify-center text-xl shrink-0 overflow-hidden">
          {entry.avatarType === 'emoji' ? entry.avatarValue : '🤖'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm md:text-base truncate">{entry.username || 'Anonymous'}</span>
            <span className="text-xs">{CHANNEL_ICONS[entry.channel] ?? '⚪'}</span>
            {entry.region && (
              <a
                href={buildRankHref({ region: entry.region })}
                className="inline-flex items-center gap-1 rounded-full border border-[#dbe4ff] bg-white px-2.5 py-1 text-[11px] font-medium text-[#475569] hover:border-[#0071e3]"
              >
                <span>{getRegionFlag(entry.region)}</span>
                <span>{getRegionLabel(entry.region, isZh)}</span>
              </a>
            )}
            {entry.company && (
              <a
                href={buildRankHref({ company: entry.company })}
                className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-medium text-[#334155] max-w-full truncate hover:border-[#0071e3]"
              >
                {entry.company}
              </a>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#94a3b8]">
            {entry.topModel && <span>{entry.topModel}</span>}
            {entry.projectCount > 0 && <span>· {entry.projectCount} {isZh ? '项目' : 'projects'}</span>}
            <span>· {new Date(entry.createdAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}</span>
          </div>

          {entry.topProject && (
            <a
              href={entry.topProject.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1.5 text-xs font-medium text-[#334155] hover:border-[#0071e3] hover:bg-white"
            >
              <span>{entry.topProject.icon}</span>
              <span className="truncate">{entry.topProject.name}</span>
            </a>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/u/${entry.id}`}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0071e3] px-4 text-sm font-semibold text-white"
            >
              {isZh ? '查看卡片' : 'View card'}
            </a>
            {entry.topProject && (
              <a
                href={entry.topProject.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#dbe4ff] bg-white px-4 text-sm font-medium text-[#475569]"
              >
                {isZh ? '打开项目' : 'Open project'}
              </a>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-bold text-sm md:text-base">{formatTokens(entry.totalTokens)}</div>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-xs">{tier.badge}</span>
            <span className="text-xs font-medium" style={{ color: tier.accent }}>{isZh ? tier.label : tier.labelEn}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto w-full px-4 pt-10">
      <div className="h-10 w-48 mx-auto rounded-xl bg-[#f1f5f9] animate-pulse mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-[#f1f5f9] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  const isZh = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language);
  return (
    <div className="text-center py-16 text-[#94a3b8] rounded-[28px] border border-[#dbe4ff] bg-white">
      <div className="text-4xl mb-3">🏜️</div>
      <p className="text-lg font-medium">{isZh ? '当前筛选下暂无用户上榜' : 'No users found for these filters'}</p>
      <p className="mt-2 text-sm">{isZh ? '换个维度看看，或者成为第一个。' : 'Try different filters or create the first card.'}</p>
      <a href="/create" className="mt-4 inline-flex min-h-11 items-center gap-2 px-6 py-3 rounded-full bg-[#0071e3] text-white font-semibold text-sm">
        {isZh ? '立即生成卡片' : 'Create my card'}
      </a>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const isZh = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language);
  return (
    <div className="max-w-4xl mx-auto w-full px-4 pt-16 text-center text-[#94a3b8]">
      <div className="text-4xl mb-3">😵</div>
      <p className="text-lg font-medium">{isZh ? '排行榜加载失败' : 'Failed to load leaderboard'}</p>
      <p className="mt-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 px-6 py-2 rounded-full border border-[#dbe4ff] text-sm font-medium hover:bg-[#f8fbff]"
      >
        {isZh ? '重新加载' : 'Reload'}
      </button>
    </div>
  );
}
