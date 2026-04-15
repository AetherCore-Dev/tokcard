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
import { formatTokens, getTokenWindowLabel } from '@/lib/card';

const PAGE_SIZE = 20;
const DEFAULT_TIME_FILTER: TimeFilter = 'month';

function normalizeCardId(value?: string): string {
  const normalized = (value || '').trim().toLowerCase();
  return /^[a-z0-9]{4,16}$/.test(normalized) ? normalized : '';
}

function getChannelLabel(channel: string, isZh: boolean): string {
  const matched = CHANNEL_FILTERS.find((item) => item.value === channel);
  return matched ? (isZh ? matched.labelZh : matched.labelEn) : channel;
}

function formatUpdatedAt(updatedAt: string | undefined, isZh: boolean): string {
  if (!updatedAt) return isZh ? '刚刚更新' : 'Just updated';

  try {
    return new Date(updatedAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return updatedAt;
  }
}

function normalizeLeaderboardPitch(value: string): string {
  const normalized = value
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.includes('\uFFFD') ? '' : normalized;
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [region, setRegion] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [time, setTime] = useState<TimeFilter>(DEFAULT_TIME_FILTER);
  const [highlightId, setHighlightId] = useState('');
  const [focusInput, setFocusInput] = useState('');
  const [focusNotFound, setFocusNotFound] = useState(false);
  const [page, setPage] = useState<number | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
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
      setFocusInput(initialFocus);
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

    if (time !== DEFAULT_TIME_FILTER) params.set('time', time);
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
  const pageTitle = browserIsZh ? 'Token 与项目榜' : 'Token & Project Leaderboard';
  const advancedFiltersVisible = showMoreFilters || Boolean(region || companyFilter || time !== DEFAULT_TIME_FILTER);
  const hasFilters = Boolean(region || companyFilter || time !== DEFAULT_TIME_FILTER || channel !== 'all');
  const selectedTimeLabel = time === 'all'
    ? (browserIsZh ? '全部周期' : 'All windows')
    : getTokenWindowLabel(time, browserIsZh ? 'zh' : 'en');
  const pageSubtitle = data && data.total > 0
    ? (browserIsZh
      ? `${data.total} 位开发者符合当前筛选，当前显示 ${rangeStart}-${rangeEnd}。先看 ${selectedTimeLabel} 的 Token 强度，再顺手看他们在做什么项目。`
      : `${data.total} builders match the current filters and you are seeing ${rangeStart}-${rangeEnd}. Start with ${selectedTimeLabel.toLowerCase()} token intensity, then inspect the projects behind it.`)
    : (browserIsZh ? '这里既是排行榜，也是发现别人项目的入口。' : 'This is both a ranking board and a place to discover what other builders are shipping.');
  const updatedAtLabel = useMemo(() => formatUpdatedAt(data?.updatedAt, browserIsZh), [browserIsZh, data?.updatedAt]);

  const buildRankHref = useCallback((overrides: { region?: string; company?: string }) => {
    const params = new URLSearchParams();
    const nextChannel = channel;
    const nextRegion = overrides.region !== undefined ? overrides.region : region;
    const nextCompany = overrides.company !== undefined ? overrides.company : companyFilter;
    const nextTime = time;

    if (nextChannel && nextChannel !== 'all') params.set('channel', nextChannel);
    if (nextRegion) params.set('region', nextRegion);
    if (nextCompany.trim()) params.set('company', nextCompany.trim());
    if (nextTime !== DEFAULT_TIME_FILTER) params.set('time', nextTime);

    const query = params.toString();
    return `/rank${query ? `?${query}` : ''}`;
  }, [channel, companyFilter, region, time]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16">
      <section className="pt-6 pb-5">
        <div className="rounded-[32px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f7faff_55%,#eef4ff_100%)] p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                  {browserIsZh ? '先看 Token，再看项目' : 'Tokens first, projects second'}
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f172a] md:text-4xl">{pageTitle}</h1>
                <p className="mt-3 text-sm leading-6 text-[#475569]">{pageSubtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <StatPill
                  label={browserIsZh ? '上榜人数' : 'Builders'}
                  value={data && data.total > 0 ? String(data.total) : '0'}
                />
                <StatPill
                  label={browserIsZh ? '当前页' : 'Page'}
                  value={data && data.total > 0 ? `${currentPage}/${totalPages}` : '1/1'}
                />
                <StatPill
                  label={browserIsZh ? '更新时间' : 'Updated'}
                  value={updatedAtLabel}
                />
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="text"
                  value={focusInput}
                  onChange={(e) => setFocusInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPage(1);
                      setHighlightId(normalizeCardId(focusInput));
                    }
                  }}
                  placeholder={browserIsZh ? '输入卡片 ID，快速看我的位置' : 'Find a card by ID'}
                  className="min-h-12 rounded-2xl border border-[#dbe4ff] bg-white px-4 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setHighlightId(normalizeCardId(focusInput));
                  }}
                  className="min-h-12 rounded-2xl bg-[#111827] px-5 text-sm font-semibold text-white"
                >
                  {browserIsZh ? '查看位置' : 'Find rank'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreFilters((current) => !current)}
                className="min-h-12 rounded-2xl border border-[#dbe4ff] bg-white px-5 text-sm font-medium text-[#475569]"
              >
                {advancedFiltersVisible ? (browserIsZh ? '收起高级筛选' : 'Hide advanced filters') : (browserIsZh ? '更多筛选' : 'More filters')}
              </button>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                  {browserIsZh ? '按 AI 渠道筛选' : 'Filter by AI channel'}
                </div>
                <div className="text-[11px] text-[#94a3b8] md:hidden">
                  {browserIsZh ? '左右滑动查看更多' : 'Swipe for more'}
                </div>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#eef4ff] to-transparent md:hidden" />
                <div className="flex gap-2 overflow-x-auto pb-1 pr-6 md:pr-0" style={{ scrollbarWidth: 'none' }}>
                  {CHANNEL_FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setPage(1);
                        setHighlightId('');
                        setChannel(item.value);
                      }}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
                        channel === item.value
                          ? 'bg-[#0071e3] text-white shadow-md'
                          : 'border border-[#dbe4ff] bg-white text-[#475569] hover:border-[#0071e3]'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span>{browserIsZh ? item.labelZh : item.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {advancedFiltersVisible && (
              <div className="grid gap-3 rounded-[24px] border border-[#dbe4ff] bg-white/80 p-4 md:grid-cols-[180px_minmax(0,1fr)_220px]">
                <label className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? '地区 / 国家' : 'Region / Country'}</span>
                  <select
                    value={region}
                    onChange={(e) => {
                      setPage(1);
                      setHighlightId('');
                      setRegion(e.target.value);
                    }}
                    className="min-h-11 rounded-2xl border border-[#dbe4ff] bg-white px-4 text-sm text-[#0f172a] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
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
                      className="min-h-11 flex-1 rounded-2xl border border-[#dbe4ff] bg-white px-4 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
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
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? 'Token 周期' : 'Token window'}</span>
                  <div className="grid grid-cols-4 gap-2">
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
                            : 'border border-[#dbe4ff] bg-white text-[#475569] hover:border-[#0071e3]'
                        }`}
                      >
                        {browserIsZh ? item.labelZh : item.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-[#dbe4ff] bg-white/80 px-4 py-3 text-xs text-[#64748b]">
                <span className="font-medium">{browserIsZh ? '当前筛选：' : 'Active filters:'}</span>
                {channel !== 'all' && (
                  <FilterChip
                    label={`${browserIsZh ? '渠道' : 'Channel'} · ${browserIsZh ? CHANNEL_FILTERS.find((item) => item.value === channel)?.labelZh : CHANNEL_FILTERS.find((item) => item.value === channel)?.labelEn ?? channel}`}
                    onClear={() => {
                      setPage(1);
                      setHighlightId('');
                      setChannel('all');
                    }}
                  />
                )}
                {region && (
                  <FilterChip
                    label={`${browserIsZh ? '地区' : 'Region'} · ${getRegionLabel(region, browserIsZh)}`}
                    onClear={() => {
                      setPage(1);
                      setHighlightId('');
                      setRegion('');
                    }}
                  />
                )}
                {companyFilter && (
                  <FilterChip
                    label={`${browserIsZh ? '组织' : 'Org'} · ${companyFilter}`}
                    onClear={() => {
                      setPage(1);
                      setHighlightId('');
                      setCompanyInput('');
                      setCompanyFilter('');
                    }}
                  />
                )}
                {time !== DEFAULT_TIME_FILTER && (
                  <FilterChip
                    label={`${browserIsZh ? '周期' : 'Window'} · ${browserIsZh ? TIME_FILTERS.find((item) => item.value === time)?.labelZh : TIME_FILTERS.find((item) => item.value === time)?.labelEn ?? time}`}
                    onClear={() => {
                      setPage(1);
                      setHighlightId('');
                      setTime(DEFAULT_TIME_FILTER);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {focusNotFound && highlightId && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {browserIsZh ? '该卡片不在当前筛选结果中，试试清除部分筛选条件。' : 'This card is not in the current filtered result. Try clearing some filters.'}
        </div>
      )}

      {data && data.entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
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

          {data && data.total > PAGE_SIZE && (
            <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-[#dbe4ff] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
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

          {topCompanies.length > 0 && (
            <div className="mt-5 rounded-[24px] border border-[#dbe4ff] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? '当前热门组织' : 'Popular orgs right now'}</div>
                  <div className="mt-1 text-sm text-[#64748b]">{browserIsZh ? '放在列表后面看，避免它抢走主榜单的注意力。' : 'Placed after the main list so the ranking stays easier to scan first.'}</div>
                </div>
                <div className="text-xs text-[#94a3b8]">{browserIsZh ? '基于当前筛选' : 'Based on current filters'}</div>
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

          <div className="mt-6 rounded-[28px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{browserIsZh ? '我也要上榜' : 'Join the board'}</div>
                <div className="mt-2 text-lg font-semibold text-[#0f172a]">{browserIsZh ? '先做一张 TokCard，再把自己的项目带进这个榜单。' : 'Create a TokCard first, then bring your project into this leaderboard.'}</div>
                <div className="mt-2 text-sm leading-6 text-[#64748b]">{browserIsZh ? 'TokCard 会先展示你的 Token 强度，再顺手把流量带去你的项目。' : 'TokCard leads with your token signal, then turns that attention into project traffic.'}</div>
              </div>
              <a
                href="/create"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0071e3] px-6 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(0,113,227,0.22)]"
              >
                {browserIsZh ? '立即生成我的卡片' : 'Create my card'}
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#dbe4ff] bg-white/90 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#0f172a]">{value}</div>
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
  const projectName = entry.primaryProjectName || entry.topProject?.name || (isZh ? '未命名项目' : 'Untitled project');
  const projectUrl = entry.primaryProjectUrl || entry.topProject?.url || '';
  const projectPitch = normalizeLeaderboardPitch(entry.primaryProjectPitch) || (isZh ? '这位开发者正在用 AI 推进一个项目。' : 'This builder is shipping with AI.');
  const tokenDisplay = formatTokens(entry.totalTokens, isZh ? 'zh' : 'en');
  const tokenFullDisplay = entry.totalTokens.toLocaleString(isZh ? 'zh-CN' : 'en-US');
  const tokenWindowLabel = getTokenWindowLabel(entry.tokenWindow, isZh ? 'zh' : 'en');
  const dateLabel = new Date(entry.createdAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
  const channelLabel = getChannelLabel(entry.channel, isZh);

  return (
    <div
      data-rank-id={entry.id}
      className={`rounded-[26px] border p-4 transition-all md:p-5 ${
        highlight
          ? 'border-[#0071e3] bg-[#f8fbff] shadow-[0_18px_42px_rgba(0,113,227,0.16)]'
          : isTop3
            ? 'border-[#dbe4ff] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]'
            : 'border-[#e8eefc] bg-white hover:border-[#dbe4ff]'
      }`}
    >
      {highlight && (
        <div className="mb-3 inline-flex items-center rounded-full border border-[#c7ddff] bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#0071e3]">
          {isZh ? '聚焦查看' : 'Focused entry'}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${
              isTop3
                ? 'border-[#dbe4ff] bg-[#f8fbff] text-[#0f172a]'
                : 'border-[#e2e8f0] bg-white text-[#64748b]'
            }`}>
              {getRankMedal(rank)}
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f1f5f9] text-xl">
              {entry.avatarType === 'emoji' ? entry.avatarValue : '🤖'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-base font-semibold text-[#0f172a]">{entry.username || 'Anonymous'}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#dbe4ff] bg-white px-2.5 py-1 text-[11px] font-medium text-[#475569]">
                  <span>{CHANNEL_ICONS[entry.channel] ?? '⚪'}</span>
                  <span>{channelLabel}</span>
                </span>
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
                    className="inline-flex max-w-full items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-medium text-[#334155] hover:border-[#0071e3]"
                  >
                    <span className="truncate">{entry.company}</span>
                  </a>
                )}
                {entry.topModel && (
                  <span className="inline-flex items-center rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-medium text-[#475569]">
                    {entry.topModel}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#94a3b8]">
                {entry.projectCount > 0 && <span>{entry.projectCount} {isZh ? '个项目' : 'projects'}</span>}
                <span>· {tokenWindowLabel}</span>
                <span>· {dateLabel}</span>
                <span>· {isZh ? `等级 ${tier.label}` : `Tier ${tier.labelEn}`}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold tracking-tight text-[#0f172a]">{projectName}</div>
                <div className="mt-2 line-clamp-2 text-sm leading-6 text-[#64748b]">{projectPitch}</div>
              </div>
              {projectUrl && (
                <a
                  href={projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5 text-xs font-medium text-[#334155] hover:border-[#0071e3]"
                >
                  <span>{entry.topProject?.icon || '🚀'}</span>
                  <span>{isZh ? '打开项目' : 'Open project'}</span>
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/u/${entry.id}`}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0071e3] px-4 text-sm font-semibold text-white"
            >
              {isZh ? '查看卡片' : 'View card'}
            </a>
            <a
              href={`/rank?focus=${entry.id}&time=${entry.tokenWindow}`}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#dbe4ff] bg-white px-4 text-sm font-medium text-[#475569]"
            >
              {isZh ? '聚焦位置' : 'Focus rank'}
            </a>
          </div>
        </div>

        <div className="shrink-0 lg:w-[210px]">
          <div className="rounded-[22px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-4 lg:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{isZh ? `${tokenWindowLabel} Token` : `${tokenWindowLabel} tokens`}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">{tokenDisplay}</div>
            <div className="mt-1 text-xs text-[#94a3b8]">{tokenFullDisplay}</div>
            <div className="mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold lg:ml-auto" style={{ color: tier.accent, borderColor: `${tier.accent}33`, backgroundColor: `${tier.accent}12` }}>
              <span>{tier.badge}</span>
              <span>{isZh ? tier.label : tier.labelEn}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8">
      <div className="h-44 rounded-[32px] bg-[#f1f5f9] animate-pulse" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-[26px] bg-[#f1f5f9] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  const isZh = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language);
  return (
    <div className="rounded-[28px] border border-[#dbe4ff] bg-white px-6 py-10 text-center text-[#94a3b8]">
      <div className="mb-3 text-4xl">🏜️</div>
      <p className="text-lg font-medium text-[#1d1d1f]">{isZh ? '当前筛选下还没有用户上榜' : 'No builders match these filters yet'}</p>
      <p className="mt-2 text-sm leading-6">{isZh ? '这不只是一个榜单，也是大家顺手发现彼此项目的地方。你可以成为这块区域里第一个被看见的人。' : 'This board is also a place to discover what other builders are shipping. You can be the first visible entry here.'}</p>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
        <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">1</div>
          <div className="mt-2 text-sm font-semibold text-[#1d1d1f]">{isZh ? '先展示 Token' : 'Lead with tokens'}</div>
          <div className="mt-1 text-xs leading-5 text-[#64748b]">{isZh ? '让别人先看到你的 AI 强度。' : 'Let people feel your AI intensity first.'}</div>
        </div>
        <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">2</div>
          <div className="mt-2 text-sm font-semibold text-[#1d1d1f]">{isZh ? '再带出项目' : 'Then show the project'}</div>
          <div className="mt-1 text-xs leading-5 text-[#64748b]">{isZh ? '让榜单顺手帮你带项目流量。' : 'Use the leaderboard to send traffic to your project.'}</div>
        </div>
        <div className="rounded-2xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">3</div>
          <div className="mt-2 text-sm font-semibold text-[#1d1d1f]">{isZh ? '成为第一个上榜者' : 'Become the first ranked card'}</div>
          <div className="mt-1 text-xs leading-5 text-[#64748b]">{isZh ? '冷启动时反而更容易被看见。' : 'Early entries stand out more during cold start.'}</div>
        </div>
      </div>
      <a href="/create" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0071e3] px-6 py-3 text-sm font-semibold text-white">
        {isZh ? '立即生成卡片' : 'Create my card'}
      </a>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const isZh = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-16 text-center text-[#94a3b8]">
      <div className="mb-3 text-4xl">😵</div>
      <p className="text-lg font-medium">{isZh ? '排行榜加载失败' : 'Failed to load leaderboard'}</p>
      <p className="mt-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 rounded-full border border-[#dbe4ff] px-6 py-2 text-sm font-medium hover:bg-[#f8fbff]"
      >
        {isZh ? '重新加载' : 'Reload'}
      </button>
    </div>
  );
}
