import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { sql } from "@/server/pg";
import { canReadAllData } from "@/lib/roles";

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
    const [trades, snapshots, promos] = await Promise.all([
      sql`select * from cfd_trades where owner_id = ${userId} order by opened_at desc`,
      sql`select payload, updated_at from journal_snapshots where user_id = ${userId} limit 1`,
      sql`select id, kind, title, created_at from promos where user_id = ${userId} order by created_at desc`,
    ]);
    return ok({
      user: target,
      trades,
      promos,
      snapshot: snapshots[0]?.payload ?? null,
      snapshotUpdatedAt: snapshots[0]?.updated_at ?? null,
    });
  }

  const [tradeStats, snapshotStats] = await Promise.all([
    sql`select owner_id,
          count(*)::int as total,
          count(*) filter (where pnl > 0)::int as wins,
          count(*) filter (where pnl < 0)::int as losses,
          count(*) filter (where status = 'running')::int as running
        from cfd_trades group by owner_id`,
    sql`select user_id, updated_at from journal_snapshots`,
  ]);
  const tradeMap = new Map(tradeStats.map((row) => [row.owner_id, row]));
  const snapshotMap = new Map(snapshotStats.map((row) => [row.user_id, row.updated_at]));

  return ok({
    members: users.map((user) => {
      const stats = tradeMap.get(user.id);
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        trades: stats?.total ?? 0,
        wins: stats?.wins ?? 0,
        losses: stats?.losses ?? 0,
        running: stats?.running ?? 0,
        snapshotUpdatedAt: snapshotMap.get(user.id) ?? null,
      };
    }),
  });
});
