const LEADERBOARD_KEY = 'tokcard:leaderboard:v1';
const MAX_ENTRIES = 200;
const MIN_TOKENS = 1;

export interface LeaderboardEntry {
  id: string;
  username: string;
  totalTokens: number;
  channel: string;
  avatarType: string;
  avatarValue: string;
  theme: string;
  projectCount: number;
  topModel: string;
  rankTierId: string;
  createdAt: string;
}

export interface LeaderboardIndex {
  version: 1;
  updatedAt: string;
  total: number;
  entries: LeaderboardEntry[];
}

function computeRankTierId(tokens: number): string {
  if (tokens >= 100_000_000_000) return 'singularity';
  if (tokens >= 10_000_000_000) return 'ultra';
  if (tokens >= 1_000_000_000) return 'mythic';
  if (tokens >= 100_000_000) return 'legend';
  if (tokens >= 10_000_000) return 'expert';
  if (tokens >= 1_000_000) return 'apprentice';
  return 'starter';
}

export async function readLeaderboard(kv: KVNamespace): Promise<LeaderboardIndex> {
  const raw = await kv.get(LEADERBOARD_KEY);
  if (!raw) {
    return { version: 1, updatedAt: new Date().toISOString(), total: 0, entries: [] };
  }
  try {
    return JSON.parse(raw) as LeaderboardIndex;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), total: 0, entries: [] };
  }
}

export function buildLeaderboardEntry(
  id: string,
  card: Record<string, unknown>
): LeaderboardEntry | null {
  const totalTokens = Number(card.t ?? 0);
  if (totalTokens < MIN_TOKENS) return null;

  const models = Array.isArray(card.mb) ? card.mb : [];
  const projects = Array.isArray(card.pr) ? card.pr : [];
  const topModel = models.length > 0 ? String((models[0] as Record<string, unknown>).name ?? '') : '';

  return {
    id,
    username: String(card.u ?? ''),
    totalTokens,
    channel: String(card.c ?? 'other'),
    avatarType: String(card.at ?? 'emoji'),
    avatarValue: String(card.av ?? '🤖'),
    theme: String(card.th ?? 'brand-light'),
    projectCount: projects.length,
    topModel,
    rankTierId: computeRankTierId(totalTokens),
    createdAt: String(card._createdAt ?? new Date().toISOString()),
  };
}

export async function upsertLeaderboard(
  kv: KVNamespace,
  entry: LeaderboardEntry
): Promise<void> {
  const index = await readLeaderboard(kv);

  const filtered = index.entries.filter((e) => e.id !== entry.id);
  const updated = [...filtered, entry]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, MAX_ENTRIES);

  const newIndex: LeaderboardIndex = {
    version: 1,
    updatedAt: new Date().toISOString(),
    total: updated.length,
    entries: updated,
  };

  await kv.put(LEADERBOARD_KEY, JSON.stringify(newIndex));
}
