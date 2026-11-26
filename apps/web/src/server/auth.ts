import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { systemDb } from "@/db";
import { loginAttempts, sessions, users } from "@/db/system-schema";

/** Session cookie for username/password accounts. No email verification by design. */
export const AUTH_COOKIE = "tj_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const secret = () => process.env.AUTH_SECRET ?? process.env.JOURNAL_SECRET ?? "dev-only-change-me";

export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

const iso = () => new Date().toISOString();

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const given = scryptSync(password, salt, 64);
  const target = Buffer.from(expected, "hex");
  return given.length === target.length && timingSafeEqual(given, target);
};

const sign = (id: string): string => createHmac("sha256", secret()).update(id).digest("hex");

export const sessionToken = (id: string): string => `${id}.${sign(id)}`;

export const readSessionToken = (token: string | undefined): string | null => {
  if (!token) return null;
  const [id, signature] = token.split(".");
  if (!id || !signature) return null;
  const expected = Buffer.from(sign(id), "hex");
  const given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return id;
};

export const createSession = (userId: string): string => {
  const id = randomBytes(32).toString("hex");
  systemDb
    .insert(sessions)
    .values({
      id,
      userId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
      createdAt: iso(),
    })
    .run();
  return sessionToken(id);
};

export const deleteSession = (token: string | undefined): void => {
  const id = readSessionToken(token);
  if (id) systemDb.delete(sessions).where(eq(sessions.id, id)).run();
};

export const currentUser = async (): Promise<AuthUser | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(AUTH_COOKIE)?.value;
  } catch {
    return null; // called outside a request (tests, scripts)
  }
  const id = readSessionToken(token);
  if (!id) return null;
  const row = systemDb
    .select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, iso())))
    .get();
  return row ? { id: row.id, username: row.username, isAdmin: row.isAdmin } : null;
};

export const requireUser = async (): Promise<AuthUser> => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
};

/** Simple per-IP/per-username brute-force protection, stored in the global DB. */
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_BLOCK_MS = 15 * 60_000;

export const loginBlockedFor = (key: string): number => {
  const row = systemDb.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
  if (!row?.blockedUntil) return 0;
  const remaining = Date.parse(row.blockedUntil) - Date.now();
  return remaining > 0 ? remaining : 0;
};

export const recordLoginFailure = (key: string): void => {
  const now = iso();
  const row = systemDb.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
  if (!row || Date.parse(row.firstFailureAt) < Date.now() - LOGIN_WINDOW_MS) {
    systemDb
      .insert(loginAttempts)
      .values({ key, failures: 1, firstFailureAt: now, lastFailureAt: now })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: { failures: 1, firstFailureAt: now, lastFailureAt: now, blockedUntil: null },
      })
      .run();
    return;
  }
  const failures = row.failures + 1;
  systemDb
    .update(loginAttempts)
    .set({
      failures,
      lastFailureAt: now,
      blockedUntil:
        failures >= LOGIN_LIMIT ? new Date(Date.now() + LOGIN_BLOCK_MS).toISOString() : null,
    })
    .where(eq(loginAttempts.key, key))
    .run();
};

export const clearLoginFailures = (key: string): void => {
  systemDb.delete(loginAttempts).where(eq(loginAttempts.key, key)).run();
};
