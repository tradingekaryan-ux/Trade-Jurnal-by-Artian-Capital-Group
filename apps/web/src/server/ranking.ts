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

/**
 * Hitung ringkasan jurnal untuk satu set trade.
 *
 * initialBalance — total saldo awal akun user (dari journal_snapshots atau 0).
 * Ketika > 0, drawdown% dihitung relatif terhadap (initialBalance + peak)
 * sehingga hasilnya konsisten dengan tampilan dashboard. Ketika 0 (tidak
 * diketahui), library fallback ke base = peak — masih bermakna tapi berbeda
 * dari dashboard; drawdown score TIDAK diset ke 0 karena formula di
 * edge-score.ts mengembalikan (1 - ddPct/0.25)*100 yang masih reasonable.
 */
const summarize = (rows: TradeRow[], mode?: string, initialBalance = 0): JournalSummary => {
  const trades = rows.map(toTrade);
  const metrics = computeMetrics(trades, {
    timeZone: "UTC",
    initialBalance,
  });
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

/**
 * Parse total initial_balance dari payload journal_snapshots.
 * Snapshot menyimpan array accounts (dari SQLite) — kita sum initial_balance.
 */
const parseInitialBalance = (payload: unknown): number => {
  if (!payload || typeof payload !== "object") return 0;
  const p = payload as Record<string, unknown>;
  // Field "accounts" di snapshot payload (dari schema SQLite)
  const accounts = Array.isArray(p["accounts"]) ? p["accounts"] : [];
  return accounts.reduce((sum: number, acc: unknown) => {
    if (acc && typeof acc === "object") {
      const rec = acc as Record<string, unknown>;
      const balance = Number(rec["initial_balance"] ?? rec["initialBalance"] ?? 0);
      return sum + (Number.isFinite(balance) ? balance : 0);
    }
    return sum;
  }, 0);
};

/** Public leaderboard: one entry per account, computed from Supabase source of truth. */
export const getRanking = async (): Promise<RankingEntry[]> => {
  const [users, profiles, trades, snapshots] = await Promise.all([
    sql`select id, username, role from users`,
    sql`select user_id, display_name, journal_name, avatar_url from profiles`,
    sql`select id, owner_id, category, symbol, mode, side, lot, entry, exit_price,
      stop_loss, take_profit, pnl, status, opened_at, closed_at
      from cfd_trades order by opened_at desc`,
    // Ambil snapshot payload untuk parse initial_balance per user
    sql`select user_id, payload from journal_snapshots`,
  ]);

  const profileMap = new Map(profiles.map((row) => [row.user_id, row]));

  // Map user_id → total initial balance (sum semua akun dari snapshot)
  const balanceMap = new Map<string, number>(
    (snapshots as unknown as { user_id: string; payload: unknown }[]).map((row) => [
      row.user_id,
      parseInitialBalance(row.payload),
    ]),
  );

  const byOwner = new Map<string, TradeRow[]>();
  for (const row of trades as unknown as TradeRow[]) {
    const list = byOwner.get(row.owner_id) ?? [];
    list.push(row);
    byOwner.set(row.owner_id, list);
  }

  const entries = users.map((user) => {
    const rows = byOwner.get(user.id) ?? [];
    const userBalance = balanceMap.get(user.id) ?? 0;
    const overall = summarize(rows, undefined, userBalance);
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
          userBalance,
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
  initialBalance = 0,
): {
  metrics: TradeMetrics;
  edge: EdgeScore;
  perMode: JournalSummary[];
} => {
  const metrics = computeMetrics(rows.map(toTrade), {
    timeZone: "UTC",
    initialBalance,
  });
  const modes = [...new Set(rows.map((row) => row.mode))].sort();
  return {
    metrics,
    edge: computeEdgeScore(metrics),
    perMode: modes.map((mode) =>
      summarize(
        rows.filter((row) => row.mode === mode),
        mode,
        initialBalance,
      ),
    ),
  };
};
