import postgres from "postgres";

const url = process.env.DATABASE_URL;

/** Shared Postgres client. Data lives in Supabase, outside the app container. */
export const sql = postgres(url ?? "postgres://invalid@localhost/invalid", {
  max: 4,
  connect_timeout: 15,
  idle_timeout: 30,
});

export const pgEnabled = () => Boolean(url && !url.includes("invalid"));
