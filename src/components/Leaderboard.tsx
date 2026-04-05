import React, { useState, useEffect, useMemo } from 'react';
import {
  type LeaderboardEntry,
  type LeaderboardIndex,
  type ChannelFilter,
  CHANNEL_FILTERS,
  RANK_TIER_BADGES,
  CHANNEL_ICONS,
  filterByChannel,
  getRankMedal,
  fetchLeaderboard,
} from '@/lib/leaderboard';
import { formatTokens } from '@/lib/card';

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ChannelFilter>('all');

  useEffect(() => {
    fetchLeaderboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterByChannel(data.entries, channel);
  }, [data, channel]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 pb-28">
      {/* Header */}
      <div className="pt-6 pb-4 text-center">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Token 排行榜
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          {data && data.total > 0
            ? `${data.total} 位开发者上榜`
            : '成为第一个上榜的人'}
        </p>
      </div>

      {/* Channel Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
        {CHANNEL_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setChannel(f.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              channel === f.value
                ? 'bg-[#0071e3] text-white shadow-md'
                : 'bg-white border border-[#dbe4ff] text-[#64748b] hover:border-[#0071e3]'
            }`}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      {filtered.length === 0 ? (
        <EmptyState channel={channel} />
      ) : (
        <div className="space-y-2">
          {filtered.map((entry, index) => (
            <LeaderboardRow key={entry.id} entry={entry} rank={index + 1} />
          ))}
        </div>
      )}

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#fbfbfd] via-[#fbfbfd] to-transparent pointer-events-none z-30">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <a
            href="/create"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-semibold text-lg bg-[#0071e3] text-white shadow-[0_18px_40px_rgba(0,113,227,0.28)] hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            我也要上榜
          </a>
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const tier = RANK_TIER_BADGES[entry.rankTierId] ?? RANK_TIER_BADGES.starter;
  const isTop3 = rank <= 3;

  return (
    <a
      href={`/u/${entry.id}`}
      className={`flex items-center gap-3 p-3 rounded-2xl transition-all hover:-translate-y-0.5 ${
        isTop3
          ? 'bg-white border border-[#dbe4ff] shadow-[0_8px_24px_rgba(0,113,227,0.08)]'
          : 'bg-white/60 border border-transparent hover:border-[#dbe4ff] hover:bg-white'
      }`}
    >
      {/* Rank */}
      <div className={`w-10 text-center font-bold shrink-0 ${
        rank === 1 ? 'text-2xl' : rank <= 3 ? 'text-xl' : 'text-sm text-[#94a3b8]'
      }`}>
        {getRankMedal(rank)}
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center text-xl shrink-0">
        {entry.avatarType === 'emoji' ? entry.avatarValue : '🤖'}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{entry.username || 'Anonymous'}</span>
          <span className="text-xs">{CHANNEL_ICONS[entry.channel] ?? '⚪'}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-[#94a3b8]">
          {entry.topModel && <span>{entry.topModel}</span>}
          {entry.projectCount > 0 && <span>· {entry.projectCount} 项目</span>}
        </div>
      </div>

      {/* Tokens + Tier */}
      <div className="text-right shrink-0">
        <div className="font-bold text-sm">{formatTokens(entry.totalTokens)}</div>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-xs">{tier.badge}</span>
          <span className="text-xs font-medium" style={{ color: tier.accent }}>
            {tier.label}
          </span>
        </div>
      </div>
    </a>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 pt-10">
      <div className="h-10 w-48 mx-auto rounded-xl bg-[#f1f5f9] animate-pulse mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-[#f1f5f9] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ channel }: { channel: ChannelFilter }) {
  const label = CHANNEL_FILTERS.find((f) => f.value === channel)?.label ?? channel;
  return (
    <div className="text-center py-16 text-[#94a3b8]">
      <div className="text-4xl mb-3">🏜️</div>
      <p className="text-lg font-medium">暂无 {label} 用户上榜</p>
      <p className="mt-2 text-sm">成为第一个！</p>
      <a href="/create" className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0071e3] text-white font-semibold text-sm">
        立即生成卡片
      </a>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 pt-16 text-center text-[#94a3b8]">
      <div className="text-4xl mb-3">😵</div>
      <p className="text-lg font-medium">排行榜加载失败</p>
      <p className="mt-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 px-6 py-2 rounded-full border border-[#dbe4ff] text-sm font-medium hover:bg-[#f8fbff]"
      >
        重新加载
      </button>
    </div>
  );
}
