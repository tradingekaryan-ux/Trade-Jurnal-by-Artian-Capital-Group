import {
  computeEdgeScore,
  computeMetrics,
  type AnnotatedTrade,
  type EdgeScore,
  type TradeMetrics,
} from "@luxalgo/journal-core";
import { MODE_LABELS, type JournalMode } from "@/lib/cfd";
import { sql } from "./pg";

export interface JournalSummary {
  mode: string;
  label: string;
  trades: number;
  closed: number;
  wins: number;
  losses: number;
  running: number;
  winRate: number | null;
  netPnl: number;
  profitFactor: number | null;
  expectancy: number | null;
  edgeScore: number | null;
  edgeComponents: EdgeScore["components"] | null;
  lastTradeAt: string | null;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  journalName: string;
  role: string;
  avatarUrl: string | null;
  edgeScore: number | null;
  edgeComponents: EdgeScore["components"] | null;
  netPnl: number;
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  maxDrawdownPct: number | null;
  lastTradeAt: string | null;
  journals: JournalSummary[];
}

interface TradeRow {
  id: string;
  owner_id: string;
  category: string;
  symbol: string;
  mode: string;
  side: string;
  lot: number;
  entry: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

/** Supabase CFD/futures/crypto/stock rows → the core analytics trade shape. */
const toTrade = (row: TradeRow): AnnotatedTrade => {
  const pnl = Number(row.pnl ?? 0);
  const status =
    row.status === "running" ? "open" : pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
  return {
    key: `cfd:${row.id}`,
    accountId: `journal-${row.owner_id}`,
    symbol: row.symbol,
    assetClass: row.category as AnnotatedTrade["assetClass"],
    direction: row.side === "buy" ? "long" : "short",
    status,
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
    quantity: Number(row.lot),
    openQuantity: status === "open" ? Number(row.lot) : 0,
    avgEntry: Number(row.entry),
    avgExit: row.exit_price ?? undefined,
    grossPnl: pnl,
    fees: 0,
    netPnl: pnl,
    executionCount: status === "open" ? 1 : 2,
    executionIds: [],
    exits: [],
    durationMs: row.closed_at ? Date.parse(row.closed_at) - Date.parse(row.opened_at) : undefined,
    annotations: {
      stopLoss: row.stop_loss ?? undefined,
      profitTarget: row.take_profit ?? undefined,
    },
  };
};

const summarize = (rows: TradeRow[], mode?: string): JournalSummary => {
  const trades = rows.map(toTrade);
  const metrics = computeMetrics(trades, { timeZone: "UTC", initialBalance: 0 });
  const edge = computeEdgeScore(metrics);
  const modeKey = mode as JournalMode | undefined;
  return {
    mode: mode ?? "all",
    label: modeKey ? (MODE_LABELS[modeKey] ?? mode) : "Semua jurnal",
    trades: metrics.totalTrades,
    closed: metrics.closedTrades,
    wins: metrics.wins,
    losses: metrics.losses,
    running: metrics.openTrades,
    winRate: metrics.winRate,
    netPnl: metrics.netPnl,
    profitFactor: metrics.profitFactorIsInfinite ? null : metrics.profitFactor,
    expectancy: metrics.expectancy,
    edgeScore: edge.score,
    edgeComponents: edge.components,
    lastTradeAt: rows.reduce<string | null>(
      (latest, row) => (!latest || row.opened_at > latest ? row.opened_at : latest),
      null,
    ),
  };
};

/** Public leaderboard: one entry per account, computed from Supabase source of truth. */
export const getRanking = async (): Promise<RankingEntry[]> => {
  const [users, profiles, trades] = await Promise.all([
    sql`select id, username, role from users`,
    sql`select user_id, display_name, journal_name, avatar_url from profiles`,
    sql`select id, owner_id, category, symbol, mode, side, lot, entry, exit_price,
      stop_loss, take_profit, pnl, status, opened_at, closed_at
      from cfd_trades order by opened_at desc`,
  ]);
  const profileMap = new Map(profiles.map((row) => [row.user_id, row]));
  const byOwner = new Map<string, TradeRow[]>();
  for (const row of trades as unknown as TradeRow[]) {
    const list = byOwner.get(row.owner_id) ?? [];
    list.push(row);
    byOwner.set(row.owner_id, list);
  }

  const entries = users.map((user) => {
    const rows = byOwner.get(user.id) ?? [];
    const overall = summarize(rows);
    const profile = profileMap.get(user.id);
    const modes = [...new Set(rows.map((row) => row.mode))].sort();
    return {
      rank: 0,
      userId: user.id,
      username: user.username,
      displayName: profile?.display_name || "",
      journalName: profile?.journal_name || `Jurnal ${user.username}`,
      role: user.role,
      avatarUrl: profile?.avatar_url ?? null,
      edgeScore: overall.edgeScore,
      edgeComponents: overall.edgeComponents,
      netPnl: overall.netPnl,
      totalTrades: overall.trades,
      closedTrades: overall.closed,
      wins: overall.wins,
      losses: overall.losses,
      winRate: overall.winRate,
      profitFactor: overall.profitFactor,
      expectancy: overall.expectancy,
      maxDrawdownPct: null,
      lastTradeAt: overall.lastTradeAt,
      journals: modes.map((mode) =>
        summarize(
          rows.filter((row) => row.mode === mode),
          mode,
        ),
      ),
    } satisfies RankingEntry;
  });

  entries.sort(
    (a, b) =>
      (b.edgeScore ?? -Infinity) - (a.edgeScore ?? -Infinity) ||
      b.netPnl - a.netPnl ||
      b.totalTrades - a.totalTrades,
  );
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
};

/** Same metric helper used by ranking, reused by the admin member detail view. */
export const summarizeTrades = (
  rows: TradeRow[],
): {
  metrics: TradeMetrics;
  edge: EdgeScore;
  perMode: JournalSummary[];
} => {
  const metrics = computeMetrics(rows.map(toTrade), { timeZone: "UTC", initialBalance: 0 });
  const modes = [...new Set(rows.map((row) => row.mode))].sort();
  return {
    metrics,
    edge: computeEdgeScore(metrics),
    perMode: modes.map((mode) =>
      summarize(
        rows.filter((row) => row.mode === mode),
        mode,
      ),
    ),
  };
};
