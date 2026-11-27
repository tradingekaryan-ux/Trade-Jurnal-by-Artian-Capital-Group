import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { sql } from "@/server/pg";
import { canReadAllData } from "@/lib/roles";
import { summarizeTrades } from "@/server/ranking";

const privileged = async () => {
  const user = await currentUser();
  return Boolean(user && canReadAllData(user.role));
};

/** Owner and admin can list every member's journal data. With ?userId= the full
 *  Supabase snapshot and all CFD/futures/crypto/stock trades for that account
 *  are returned, read directly from the source of truth. */
export const GET = handler(async (request: Request) => {
  if (!(await privileged())) return bad("Forbidden", 403);
  const userId = new URL(request.url).searchParams.get("userId");

  const users =
    await sql`select id, username, role, created_at, last_login_at from users order by created_at`;

  if (userId) {
    const target = users.find((row) => row.id === userId);
    requireValue(Boolean(target), "Member tidak ditemukan.");
    const [trades, snapshots, promos, profiles] = await Promise.all([
      sql`select * from cfd_trades where owner_id = ${userId} order by opened_at desc`,
      sql`select payload, updated_at from journal_snapshots where user_id = ${userId} limit 1`,
      sql`select id, kind, title, created_at from promos where user_id = ${userId} order by created_at desc`,
      sql`select journal_name, display_name from profiles where user_id = ${userId} limit 1`,
    ]);
    const analysis = summarizeTrades(trades as unknown as Parameters<typeof summarizeTrades>[0]);
    const payload = (snapshots[0]?.payload ?? {}) as Record<string, unknown[]>;
    const pick = (key: string) => (Array.isArray(payload[key]) ? payload[key] : []);
    return ok({
      user: target,
      profile: profiles[0] ?? null,
      trades,
      promos,
      analysis: {
        metrics: analysis.metrics,
        edge: analysis.edge,
        journals: analysis.perMode,
      },
      workspace: {
        notes: pick("notes"),
        folders: pick("folders"),
        playbooks: pick("playbooks"),
        progressRules: pick("progress_rules"),
        progressChecks: pick("progress_checks"),
        missedTrades: pick("missed_trades"),
        journalDays: pick("journal_days"),
        tradeRuleChecks: pick("trade_rule_checks"),
      },
      snapshotUpdatedAt: snapshots[0]?.updated_at ?? null,
    });
  }

  const [trades, snapshotStats, profiles] = await Promise.all([
    sql`select id, owner_id, category, symbol, mode, side, lot, entry, exit_price,
      stop_loss, take_profit, pnl, status, opened_at, closed_at from cfd_trades`,
    sql`select user_id, updated_at from journal_snapshots`,
    sql`select user_id, journal_name from profiles`,
  ]);
  const byOwner = new Map<string, Parameters<typeof summarizeTrades>[0]>();
  for (const row of trades as unknown as Parameters<typeof summarizeTrades>[0]) {
    const list = byOwner.get(row.owner_id) ?? [];
    list.push(row);
    byOwner.set(row.owner_id, list);
  }
  const snapshotMap = new Map(snapshotStats.map((row) => [row.user_id, row.updated_at]));
  const profileMap = new Map(profiles.map((row) => [row.user_id, row.journal_name]));

  return ok({
    members: users.map((user) => {
      const rows = byOwner.get(user.id) ?? [];
      const analysis = summarizeTrades(rows);
      const metrics = analysis.metrics;
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        journalName: profileMap.get(user.id) || `Jurnal ${user.username}`,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        trades: metrics.totalTrades,
        wins: metrics.wins,
        losses: metrics.losses,
        running: metrics.openTrades,
        edgeScore: analysis.edge.score,
        snapshotUpdatedAt: snapshotMap.get(user.id) ?? null,
      };
    }),
  });
});
