const LEADERBOARD_KEY = 'tokcard:leaderboard:v1';
const LEADERBOARD_ENTRY_PREFIX = 'tokcard:leaderboard:entry:';
const LEADERBOARD_MIGRATION_KEY = 'tokcard:leaderboard:migrated:v2';
const MAX_ENTRIES = 200;
const MIN_TOKENS = 1;
const DEFAULT_ENTRY_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface LeaderboardEntry {
  id: string;
  username: string;
  totalTokens: number;
  tokenWindow: 'day' | 'week' | 'month';
  channel: string;
  avatarType: string;
  avatarValue: string;
  theme: string;
  projectCount: number;
  primaryProjectName: string;
  primaryProjectUrl: string;
  primaryProjectPitch: string;
  topProject?: {
    name: string;
    url: string;
    icon: string;
  };
  topModel: string;
  rankTierId: string;
  createdAt: string;
  region?: string;
  company?: string;
}

export interface LeaderboardIndex {
  version: 1;
  updatedAt: string;
  total: number;
  entries: LeaderboardEntry[];
}

export interface LeaderboardFilters {
  region?: string;
  company?: string;
  time?: 'day' | 'week' | 'month' | 'all';
  channel?: string;
}

export interface RankSummary {
  globalRank: number;
  totalCards: number;
  channelRank: number | null;
  regionRank: number | null;
  percentile: number;
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

function emptyLeaderboard(): LeaderboardIndex {
  return { version: 1, updatedAt: new Date().toISOString(), total: 0, entries: [] };
}

function normalizeRegion(value?: string): string | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
  return normalized || undefined;
}

function normalizeCompany(value?: string): string | undefined {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 64);
  return normalized || undefined;
}

function normalizeUrl(value?: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';

  try {
    const { protocol } = new URL(normalized);
    return protocol === 'https:' || protocol === 'http:' ? normalized : '';
  } catch {
    return '';
  }
}

function normalizeTime(value?: string): 'day' | 'week' | 'month' | 'all' {
  return value === 'day' || value === 'week' || value === 'month' ? value : 'all';
}

function normalizeLeaderboardText(value: unknown, maxLength: number): string {
  const raw = String(value ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw || raw.includes('\uFFFD')) {
    return '';
  }

  return raw.slice(0, maxLength);
}

function matchesFilters(entry: LeaderboardEntry, filters: LeaderboardFilters): boolean {
  if (filters.channel && filters.channel !== 'all' && entry.channel !== filters.channel) {
    return false;
  }

  const region = normalizeRegion(filters.region);
  if (region && normalizeRegion(entry.region) !== region) {
    return false;
  }

  const company = normalizeCompany(filters.company)?.toLowerCase();
  if (company && normalizeCompany(entry.company)?.toLowerCase() !== company) {
    return false;
  }

  const time = normalizeTime(filters.time);
  if (time !== 'all' && entry.tokenWindow !== time) {
    return false;
  }

  return true;
}

function getLeaderboardEntryKey(id: string): string {
  return `${LEADERBOARD_ENTRY_PREFIX}${id}`;
}

function sanitizeLeaderboardEntry(raw: Partial<LeaderboardEntry> | null | undefined): LeaderboardEntry | null {
  if (!raw) return null;

  const id = String(raw.id ?? '').trim().toLowerCase();
  if (!/^[a-z0-9]{4,16}$/.test(id)) return null;

  const totalTokens = Number(raw.totalTokens ?? 0);
  if (!Number.isFinite(totalTokens) || totalTokens < MIN_TOKENS) return null;

  const maybeTopProject = raw.topProject && typeof raw.topProject === 'object'
    ? raw.topProject as { name?: unknown; url?: unknown; icon?: unknown }
    : null;
  const topProjectName = String(maybeTopProject?.name ?? '').trim().slice(0, 28);
  const topProjectUrl = normalizeUrl(maybeTopProject?.url);
  const primaryProjectName = String(raw.primaryProjectName ?? topProjectName).trim().slice(0, 64);
  const primaryProjectUrl = normalizeUrl(raw.primaryProjectUrl) || topProjectUrl;
  const primaryProjectPitch = normalizeLeaderboardText(raw.primaryProjectPitch, 140);

  return {
    id,
    username: String(raw.username ?? '').slice(0, 64),
    totalTokens,
    tokenWindow: String(raw.tokenWindow ?? 'month') === 'day'
      ? 'day'
      : String(raw.tokenWindow ?? 'month') === 'week'
        ? 'week'
        : 'month',
    channel: String(raw.channel ?? 'other').slice(0, 16),
    avatarType: String(raw.avatarType ?? 'emoji').slice(0, 16),
    avatarValue: String(raw.avatarValue ?? '🤖').slice(0, 256),
    theme: String(raw.theme ?? 'brand-light').slice(0, 32),
    projectCount: Math.max(0, Math.min(999, Number(raw.projectCount ?? 0) || 0)),
    primaryProjectName,
    primaryProjectUrl,
    primaryProjectPitch,
    topProject: (primaryProjectName && primaryProjectUrl) || (topProjectName && topProjectUrl)
      ? {
          name: (primaryProjectName || topProjectName).slice(0, 28),
          url: primaryProjectUrl || topProjectUrl,
          icon: String(maybeTopProject?.icon ?? '✨').trim().slice(0, 4) || '✨',
        }
      : undefined,
    topModel: String(raw.topModel ?? '').slice(0, 32),
    rankTierId: computeRankTierId(totalTokens),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    region: normalizeRegion(raw.region),
    company: normalizeCompany(raw.company),
  };
}

function buildLeaderboardIndex(entries: LeaderboardEntry[]): LeaderboardIndex {
  const deduped = new Map<string, LeaderboardEntry>();
  entries.forEach((entry) => {
    deduped.set(entry.id, entry);
  });

  const sorted = [...deduped.values()]
    .sort((a, b) => b.totalTokens - a.totalTokens || b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ENTRIES);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    total: sorted.length,
    entries: sorted,
  };
}

async function readLegacyLeaderboardEntries(kv: KVNamespace): Promise<LeaderboardEntry[]> {
  const raw = await kv.get(LEADERBOARD_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<LeaderboardIndex>;
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .map((entry) => sanitizeLeaderboardEntry(entry as Partial<LeaderboardEntry>))
      .filter((entry): entry is LeaderboardEntry => Boolean(entry));
  } catch {
    return [];
  }
}

async function writeLeaderboardEntryRecord(
  kv: KVNamespace,
  entry: LeaderboardEntry,
  expirationTtl = DEFAULT_ENTRY_TTL_SECONDS
): Promise<void> {
  await kv.put(getLeaderboardEntryKey(entry.id), JSON.stringify(entry), {
    expirationTtl,
  });
}

async function readStoredLeaderboardEntries(kv: KVNamespace): Promise<LeaderboardEntry[]> {
  const entries: LeaderboardEntry[] = [];
  let cursor: string | undefined;

  do {
    const page = await kv.list({ prefix: LEADERBOARD_ENTRY_PREFIX, cursor });
    const values = await Promise.all(page.keys.map((key) => kv.get(key.name)));

    values.forEach((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Partial<LeaderboardEntry>;
        const entry = sanitizeLeaderboardEntry(parsed);
        if (entry) {
          entries.push(entry);
        }
      } catch {
        // Ignore malformed leaderboard entry records
      }
    });

    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return entries;
}

async function hasMigratedLeaderboard(kv: KVNamespace): Promise<boolean> {
  return (await kv.get(LEADERBOARD_MIGRATION_KEY)) === '1';
}

async function migrateLegacyLeaderboardEntries(
  kv: KVNamespace,
  expirationTtl = DEFAULT_ENTRY_TTL_SECONDS
): Promise<void> {
  if (await hasMigratedLeaderboard(kv)) {
    return;
  }

  const legacyEntries = await readLegacyLeaderboardEntries(kv);
  if (legacyEntries.length > 0) {
    await Promise.all(legacyEntries.map((entry) => writeLeaderboardEntryRecord(kv, entry, expirationTtl)));
  }

  await kv.put(LEADERBOARD_MIGRATION_KEY, '1');
}

export async function readLeaderboard(kv: KVNamespace): Promise<LeaderboardIndex> {
  const [migrated, storedEntries] = await Promise.all([
    hasMigratedLeaderboard(kv),
    readStoredLeaderboardEntries(kv),
  ]);

  if (migrated) {
    return storedEntries.length > 0 ? buildLeaderboardIndex(storedEntries) : emptyLeaderboard();
  }

  const legacyEntries = await readLegacyLeaderboardEntries(kv);
  if (legacyEntries.length === 0 && storedEntries.length === 0) {
    return emptyLeaderboard();
  }

  const storedIds = new Set(storedEntries.map((entry) => entry.id));
  const fallbackLegacyEntries = legacyEntries.filter((entry) => !storedIds.has(entry.id));
  return buildLeaderboardIndex([...fallbackLegacyEntries, ...storedEntries]);
}

export async function readFilteredLeaderboard(
  kv: KVNamespace,
  filters: LeaderboardFilters
): Promise<LeaderboardIndex> {
  const index = await readLeaderboard(kv);
  const entries = index.entries.filter((entry) => matchesFilters(entry, filters));
  return {
    version: 1,
    updatedAt: index.updatedAt,
    total: entries.length,
    entries,
  };
}

export function buildLeaderboardEntry(
  id: string,
  card: Record<string, unknown>
): LeaderboardEntry | null {
  const totalTokens = Number(card.t ?? 0);
  if (totalTokens < MIN_TOKENS) return null;

  // Self-reported cards are excluded from the public leaderboard
  const trustTier = String(card.tr ?? 'self-reported');
  if (trustTier === 'self-reported') return null;

  const models = Array.isArray(card.mb) ? card.mb : [];
  const projects = Array.isArray(card.pr) ? card.pr : [];
  const topModel = models.length > 0 ? String((models[0] as Record<string, unknown>).name ?? '') : '';
  const topProject = projects.find((project) => {
    const value = project as Record<string, unknown>;
    return String(value.name ?? '').trim() && normalizeUrl(value.url);
  }) as Record<string, unknown> | undefined;
  const primaryProjectName = String(card.ppn ?? topProject?.name ?? '').trim().slice(0, 64);
  const primaryProjectUrl = normalizeUrl(card.ppu) || normalizeUrl(topProject?.url);
  const primaryProjectPitch = normalizeLeaderboardText(card.ppp, 140);

  return {
    id,
    username: String(card.u ?? ''),
    totalTokens,
    tokenWindow: String(card.tw ?? 'month') === 'day'
      ? 'day'
      : String(card.tw ?? 'month') === 'week'
        ? 'week'
        : 'month',
    channel: String(card.c ?? 'other'),
    avatarType: String(card.at ?? 'emoji'),
    avatarValue: String(card.av ?? '🤖'),
    theme: String(card.th ?? 'brand-light'),
    projectCount: projects.length,
    primaryProjectName,
    primaryProjectUrl,
    primaryProjectPitch,
    topProject: (primaryProjectName && primaryProjectUrl) || topProject
      ? {
          name: (primaryProjectName || String(topProject?.name ?? '')).trim().slice(0, 28),
          url: primaryProjectUrl || normalizeUrl(topProject?.url),
          icon: String(topProject?.icon ?? '✨').trim().slice(0, 4) || '✨',
        }
      : undefined,
    topModel,
    rankTierId: computeRankTierId(totalTokens),
    createdAt: String(card.ca ?? card._createdAt ?? new Date().toISOString()),
    region: normalizeRegion(String(card.reg ?? '')),
    company: normalizeCompany(String(card.org ?? '')),
  };
}

export async function upsertLeaderboard(
  kv: KVNamespace,
  entry: LeaderboardEntry,
  expirationTtl = DEFAULT_ENTRY_TTL_SECONDS
): Promise<void> {
  await migrateLegacyLeaderboardEntries(kv, expirationTtl);
  await writeLeaderboardEntryRecord(kv, entry, expirationTtl);
}

function getRank(entries: LeaderboardEntry[], id: string): number | null {
  const index = entries.findIndex((entry) => entry.id === id);
  return index === -1 ? null : index + 1;
}

export async function getRankSummary(kv: KVNamespace, id: string): Promise<RankSummary | null> {
  const index = await readLeaderboard(kv);
  const entry = index.entries.find((item) => item.id === id);
  if (!entry) return null;

  const comparableEntries = index.entries.filter((item) => item.tokenWindow === entry.tokenWindow);
  const globalRank = getRank(comparableEntries, id);
  if (!globalRank) return null;

  const channelEntries = comparableEntries.filter((item) => item.channel === entry.channel);
  const regionEntries = entry.region
    ? comparableEntries.filter((item) => normalizeRegion(item.region) === entry.region)
    : [];

  return {
    globalRank,
    totalCards: comparableEntries.length,
    channelRank: getRank(channelEntries, id),
    regionRank: regionEntries.length > 0 ? getRank(regionEntries, id) : null,
    percentile: Math.max(1, Math.round((globalRank / Math.max(comparableEntries.length, 1)) * 100)),
  };
}
