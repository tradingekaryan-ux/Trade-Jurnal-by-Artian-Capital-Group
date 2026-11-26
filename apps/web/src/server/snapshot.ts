import { tenantDb } from "@/db";
import { nowIso } from "./ids";
import { sql } from "./pg";

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

function sqlite() {
  return tenantDb().$client as unknown as {
    prepare: (query: string) => {
      all: () => Record<string, unknown>[];
      run: (...values: unknown[]) => void;
    };
    exec: (query: string) => void;
  };
}

/** Dump all user data from the local cache into Supabase. */
export async function snapshotUser(userId: string): Promise<void> {
  const client = sqlite();
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

const restored = new Set<string>();

/** Restore the local cache from Supabase once per process/user. */
export async function ensureRestored(userId: string): Promise<void> {
  if (restored.has(userId)) return;
  restored.add(userId);
  const rows = await sql`select payload from journal_snapshots where user_id = ${userId} limit 1`;
  const payload = rows[0]?.payload as Snapshot | undefined;
  if (!payload) return;
  const client = sqlite();
  for (const table of TABLES) {
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
}
