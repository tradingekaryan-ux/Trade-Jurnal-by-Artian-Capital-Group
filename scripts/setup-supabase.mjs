import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "../apps/web/node_modules/postgres/src/index.js";

/** Apply the Supabase schema. DATABASE_URL must be set in the environment. */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL tidak di-set.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, connect_timeout: 20 });
try {
  const schema = readFileSync(join(process.cwd(), "scripts", "supabase-schema.sql"), "utf8");
  await sql.unsafe(schema);
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `;
  console.log("Skema siap. Tabel:", tables.map((row) => row.table_name).join(", "));
} finally {
  await sql.end();
}
