import postgres from "postgres";

const url = process.env.DATABASE_URL;

/** Shared Postgres client. Data lives in Supabase, outside the app container.
 *
 * max=5 — aman untuk Transaction Pooler (port 6543) dan mencegah deadlock
 *         saat Promise.all() menjalankan beberapa query paralel (max=1
 *         menyebabkan hang pada pgBouncer transaction mode).
 *
 * prepare=false — wajib untuk pgBouncer Transaction Pooler (port 6543).
 *
 * idle_timeout=10 — tutup koneksi idle cepat agar pool tidak terpakai lama.
 */
export const sql = postgres(url ?? "postgres://invalid@localhost/invalid", {
  max: 5,
  connect_timeout: 15,
  idle_timeout: 10,
  max_lifetime: 30,
  prepare: false,
});

export const pgEnabled = () => Boolean(url && !url.includes("invalid"));
