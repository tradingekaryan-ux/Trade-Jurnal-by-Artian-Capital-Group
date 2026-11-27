import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import * as systemSchema from "./system-schema";
import { openJournalDatabase } from "./bootstrap";
import { openSystemDatabase } from "./system-bootstrap";

export const dataDir = (): string =>
  process.env.JOURNAL_DATA_DIR ??
  (process.env.VERCEL ? "/tmp/artian-journal-data" : join(process.cwd(), "data"));

type TenantDb = ReturnType<typeof createTenantDb>;
type SystemDb = ReturnType<typeof createSystemDb>;

const createTenantDb = (file: string) => {
  mkdirSync(dirname(file), { recursive: true });
  return drizzle(openJournalDatabase(file), { schema });
};

const createSystemDb = () => {
  mkdirSync(dataDir(), { recursive: true });
  return drizzle(openSystemDatabase(join(dataDir(), "system.db")), { schema: systemSchema });
};

/** Requests without a user (bootstrap, scripts, tests) use a dedicated database. */
export const SYSTEM_USER = "__system__";
const tenantStore = new AsyncLocalStorage<string>();

/** Run a unit of work inside a user's database context. */
export const runAsUser = <T>(userId: string, work: () => T): T => tenantStore.run(userId, work);

export const currentUserId = (): string =>
  tenantStore.getStore() ?? (process.env.AUTH_DISABLED === "1" ? "test-user" : SYSTEM_USER);

const globalForDb = globalThis as unknown as {
  __tenantDbs?: Map<string, TenantDb>;
  __systemDb?: SystemDb;
};

const tenantCache = (globalForDb.__tenantDbs ??= new Map<string, TenantDb>());

/** Open (and cache) the journal database that belongs to one user. */
export function tenantDb(userId: string = currentUserId()): TenantDb {
  const existing = tenantCache.get(userId);
  if (existing) return existing;
  // Tests exercise the original single-file layout; production isolates every
  // user in their own database file.
  const file =
    process.env.AUTH_DISABLED === "1" || userId === SYSTEM_USER
      ? join(dataDir(), "journal.db")
      : join(dataDir(), "users", `${userId}.db`);
  const created = createTenantDb(file);
  tenantCache.set(userId, created);
  return created;
}

/** Release a user's local SQLite file so it can be removed on account deletion. */
export function closeTenantDb(userId: string): void {
  const opened = tenantCache.get(userId);
  if (!opened) return;
  try {
    (opened.$client as { close?: () => void }).close?.();
  } catch {
    // Already closed — nothing to release.
  }
  tenantCache.delete(userId);
}

/** Global database shared by every request: users, sessions, quota, model catalog. */
export const systemDb: SystemDb = (globalForDb.__systemDb ??= createSystemDb());

/**
 * Tenant-aware database facade. Every query in the existing application keeps
 * `import { db } from "@/db"`, but transparently runs against the database of
 * the user resolved by the request handler. Nothing can reach another user's
 * file because the user id comes from the verified session, never from input.
 */
export const db = new Proxy({} as TenantDb, {
  get(_target, property) {
    const target = tenantDb();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
  has(_target, property) {
    return Reflect.has(tenantDb(), property);
  },
});

export * from "./schema";
