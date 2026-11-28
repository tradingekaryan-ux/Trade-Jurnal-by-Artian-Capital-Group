import { eq } from "drizzle-orm";
import { db, accounts, trades } from "@/db";
import { newId, nowIso } from "./ids";
import { sql } from "./pg";

interface CfdRow {
  id: string;
  owner_id: string;
  account_id: string | null;
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
  notes: string | null;
}

/**
 * Mirror Supabase journal trades into the upstream SQLite analytics engine so
 * Dashboard / Calendar / Daily journal / Reports / Trades list show the same
 * records. SQLite remains a derived cache — Supabase is the source of truth.
 *
 * Hanya baris mirror (`key like 'cfd:%'`) yang disentuh. Trade hasil import /
 * broker sync dan semua anotasi (notes, tags, playbook, rating) dibiarkan utuh.
 */
export async function syncJournalsToLegacy(userId: string): Promise<number> {
  const rows = await sql`select * from cfd_trades where owner_id = ${userId}`;
  const list = rows as unknown as CfdRow[];
  const defaultAccountId = `journal-${userId}`;
  const timestamp = nowIso();
  const mirrorKeys = new Set(list.map((row) => `cfd:${row.id}`));

  // Hapus HANYA mirror yang sudah tidak ada di Supabase.
  const existing = db.select().from(trades).all();
  for (const row of existing) {
    if (row.key.startsWith("cfd:") && !mirrorKeys.has(row.key)) {
      db.delete(trades).where(eq(trades.key, row.key)).run();
    }
  }

  // Pastikan akun mirror ada (untuk trade tanpa account_id).
  const mirrorAccount = db.select().from(accounts).where(eq(accounts.id, defaultAccountId)).get();
  if (!mirrorAccount)
    db.insert(accounts)
      .values({
        id: defaultAccountId,
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
    const status: "open" | "win" | "loss" | "breakeven" =
      row.status !== "closed"
        ? "open"
        : (row.pnl ?? 0) > 0
          ? "win"
          : (row.pnl ?? 0) < 0
            ? "loss"
            : "breakeven";
    const pnl = row.pnl ?? 0;
    const accountId = row.account_id || defaultAccountId;
    const key = `cfd:${row.id}`;

    const values = {
      accountId,
      symbol: row.symbol,
      assetClass: row.category,
      direction: (row.side === "buy" ? "long" : "short") as "long" | "short",
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
    };
    const current = db.select().from(trades).where(eq(trades.key, key)).get();
    if (current) {
      // Pertahankan anotasi milik user (notes, tags, playbook, rating).
      db.update(trades).set(values).where(eq(trades.key, key)).run();
    } else {
      db.insert(trades)
        .values({ key, ...values })
        .run();
    }
  }
  return list.length;
}
