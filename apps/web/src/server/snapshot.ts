import { tenantDb } from "@/db";
import { nowIso } from "./ids";
import { sql } from "./pg";
import { invalidateSyncCache } from "./legacy-sync";

/** Tables copied between the local SQLite cache and Supabase. */
const TABLES = [
  "accounts",
  "executions",
  "trades",
  "journal_days",
  "folders",
  "notes",
  "note_templates",
  "playbooks",
  "trade_rule_checks",
  "progress_rules",
  "progress_checks",
  "missed_trades",
  "settings",
  "import_sources",
  "import_source_aliases",
  "import_batches",
  "market_csv_datasets",
  "trade_excursions",
] as const;

type Snapshot = Record<string, Record<string, unknown>[]>;

function sqlite(userId: string) {
  return tenantDb(userId).$client as unknown as {
    prepare: (query: string) => {
      all: () => Record<string, unknown>[];
      run: (...values: unknown[]) => void;
    };
    exec: (query: string) => void;
  };
}

/** Dump all user data from the local cache into Supabase. */
export async function snapshotUser(userId: string): Promise<void> {
  const client = sqlite(userId);
  const payload: Snapshot = {};
  for (const table of TABLES) {
    try {
      payload[table] = client.prepare(`select * from ${table}`).all();
    } catch {
      payload[table] = [];
    }
  }
  await sql`insert into journal_snapshots (user_id, payload, updated_at)
    values (${userId}, ${sql.json(payload as never)}, ${nowIso()})
    on conflict (user_id) do update set payload = ${sql.json(payload as never)}, updated_at = ${nowIso()}`;
}

/** userId → updated_at terakhir yang berhasil di-restore. */
const restored = new Map<string, string>();

/** Forget a user after their account (and snapshot) is deleted. */
export const forgetRestored = (userId: string): void => {
  restored.delete(userId);
};

/**
 * Restore the local cache from Supabase.
 *
 * Dijalankan ulang setiap kali `updated_at` snapshot berubah (misalnya ketika
 * instance Vercel lain menghapus trade). Seluruh tabel dikosongkan lalu diisi
 * ulang dari snapshot dalam satu transaksi — `insert or replace` saja tidak
 * menghapus baris yang sudah dihapus, sehingga trade lama "hidup kembali".
 */
export async function ensureRestored(userId: string): Promise<void> {
  const rows =
    await sql`select payload, updated_at from journal_snapshots where user_id = ${userId} limit 1`;
  const row = rows[0];
  const updatedAt = row?.updated_at ? String(row.updated_at) : null;
  if (!row?.payload) return;
  if (updatedAt && restored.get(userId) === updatedAt) return;

  const payload = row.payload as Snapshot;
  const client = sqlite(userId);
  client.exec("begin");
  try {
    for (const table of TABLES) {
      client.prepare(`delete from ${table}`).run();
      const records = payload[table];
      if (!Array.isArray(records) || records.length === 0) continue;
      const columns = Object.keys(records[0]!);
      const quoted = columns.map((c) => `"${c}"`).join(",");
      const placeholders = columns.map(() => "?").join(",");
      const insert = client.prepare(
        `insert or replace into ${table} (${quoted}) values (${placeholders})`,
      );
      for (const record of records) {
        try {
          insert.run(...columns.map((c) => record[c] ?? null));
        } catch {
          // A row that no longer fits the current schema is ignored.
        }
      }
    }
    client.exec("commit");
    if (updatedAt) restored.set(userId, updatedAt);
    // SQLite baru saja diisi ulang dari snapshot → paksa mirror sync berikutnya.
    invalidateSyncCache(userId);
  } catch (error) {
    client.exec("rollback");
    throw error;
  }
}
