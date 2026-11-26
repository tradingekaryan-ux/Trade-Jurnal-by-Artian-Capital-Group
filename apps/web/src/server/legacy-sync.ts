import { eq } from "drizzle-orm";
import { db, accounts, trades, executions } from "@/db";
import { newId, nowIso } from "./ids";
import { sql } from "./pg";

interface CfdRow {
  id: string;
  owner_id: string;
  category: string;
  symbol: string;
  mode: string;
  side: string;
  lot: number;
  entry: number;
  exit_price: number | null;
  pnl: number | null;
  pips: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

/**
 * Mirror Supabase journal trades into the upstream SQLite analytics engine so
 * Dashboard / Calendar / Daily journal / Reports / Trades list show the same
 * records. SQLite remains a derived cache — Supabase is the source of truth.
 */
export async function syncJournalsToLegacy(userId: string): Promise<number> {
  const rows = await sql`select * from cfd_trades where owner_id = ${userId}`;
  const list = rows as unknown as CfdRow[];
  const accountId = `journal-${userId}`;
  const timestamp = nowIso();

  // Clear stale demo / mirrored rows in this user's local analytics DB.
  db.delete(executions).run();
  db.delete(trades).run();
  const existing = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!existing)
    db.insert(accounts)
      .values({
        id: accountId,
        name: "Trade Jurnal",
        broker: "",
        kind: "manual",
        currency: "USD",
        initialBalance: 0,
        profitCalcMethod: "fifo",
        autoSync: false,
        createdAt: timestamp,
      })
      .run();

  for (const row of list) {
    const openTime = row.opened_at;
    const closeTime = row.closed_at;
    const status =
      row.status !== "closed"
        ? "open"
        : (row.pnl ?? 0) > 0
          ? "win"
          : (row.pnl ?? 0) < 0
            ? "loss"
            : "breakeven";
    const pnl = row.pnl ?? 0;
    db.insert(trades)
      .values({
        key: `cfd:${row.id}`,
        accountId,
        symbol: row.symbol,
        assetClass: row.category,
        direction: row.side === "buy" ? "long" : "short",
        status,
        openedAt: openTime,
        closedAt: closeTime,
        quantity: row.lot,
        openQuantity: status === "open" ? row.lot : 0,
        avgEntry: row.entry,
        avgExit: row.exit_price,
        grossPnl: pnl,
        fees: 0,
        netPnl: pnl,
        executionCount: status === "open" ? 1 : 2,
        executionIdsJson: "[]",
        exitsJson: "[]",
        durationMs: closeTime ? Date.parse(closeTime) - Date.parse(openTime) : null,
      })
      .onConflictDoUpdate({
        target: trades.key,
        set: {
          symbol: row.symbol,
          status,
          closedAt: closeTime,
          quantity: row.lot,
          openQuantity: status === "open" ? row.lot : 0,
          avgEntry: row.entry,
          avgExit: row.exit_price,
          grossPnl: pnl,
          netPnl: pnl,
          durationMs: closeTime ? Date.parse(closeTime) - Date.parse(openTime) : null,
        },
      })
      .run();
  }
  return list.length;
}
