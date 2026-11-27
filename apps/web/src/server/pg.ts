import postgres from "postgres";

const url = process.env.DATABASE_URL;

/** Shared Postgres client. Data lives in Supabase, outside the app container.
 *
 * max=1 — Vercel bisa spawn banyak function instances secara paralel.
 *         1 koneksi per instance = aman di Session Pooler (pool_size 15).
 *         Jika pakai Transaction Pooler (port 6543) tidak ada batas ini.
 *
 * prepare=false — kompatibel dengan Session Pooler maupun Transaction Pooler
 *                 (pgBouncer transaction mode tidak mendukung prepared stmt).
 *
 * idle_timeout=10 — tutup koneksi idle cepat agar pool tidak terpakai lama.
 */
export const sql = postgres(url ?? "postgres://invalid@localhost/invalid", {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 10,
  max_lifetime: 30,
  prepare: false,
});

export const pgEnabled = () => Boolean(url && !url.includes("invalid"));
