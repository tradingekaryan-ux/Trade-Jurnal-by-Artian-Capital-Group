import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./pg";
import { isUserRole, type UserRole } from "@/lib/roles";

/** Session cookie for username/password accounts. No email verification by design. */
export const AUTH_COOKIE = "tj_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const secret = (): string => {
  const value = process.env.AUTH_SECRET ?? process.env.JOURNAL_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production" && process.env.AUTH_DISABLED !== "1")
      throw new Error("AUTH_SECRET wajib diset di produksi.");
    return "dev-only-change-me";
  }
  return value;
};

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  isAdmin: boolean;
}

const iso = () => new Date().toISOString();

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
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
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
};

export const createSession = async (userId: string): Promise<string> => {
  const id = randomBytes(32).toString("hex");
  await sql`insert into sessions (id, user_id, expires_at, created_at)
    values (${id}, ${userId}, ${new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString()}, ${iso()})`;
  return sessionToken(id);
};

export const deleteSession = async (token: string | undefined): Promise<void> => {
  const id = readSessionToken(token);
  if (id) await sql`delete from sessions where id = ${id}`;
};

export const currentUser = async (): Promise<AuthUser | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(AUTH_COOKIE)?.value;
  } catch {
    return null;
  }
  const id = readSessionToken(token);
  if (!id) return null;
  const rows = await sql`
    select u.id, u.username, u.role, u.is_admin, s.expires_at
    from sessions s join users u on s.user_id = u.id
    where s.id = ${id} and s.expires_at > ${iso()}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: isUserRole(row.role) ? row.role : "member",
    isAdmin: Boolean(row.is_admin),
  };
};

export const requireUser = async (): Promise<AuthUser> => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
};

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_BLOCK_MS = 15 * 60_000;

export const loginBlockedFor = async (key: string): Promise<number> => {
  const rows = await sql`select blocked_until from login_attempts where key = ${key} limit 1`;
  const blocked = rows[0]?.blocked_until;
  if (!blocked) return 0;
  return Math.max(0, Date.parse(String(blocked)) - Date.now());
};

export const recordLoginFailure = async (key: string): Promise<void> => {
  const now = iso();
  const rows =
    await sql`select failures, first_failure_at from login_attempts where key = ${key} limit 1`;
  const row = rows[0];
  if (!row || Date.parse(String(row.first_failure_at)) < Date.now() - LOGIN_WINDOW_MS) {
    await sql`insert into login_attempts (key, failures, first_failure_at, last_failure_at)
      values (${key}, 1, ${now}, ${now})
      on conflict (key) do update set failures = 1, first_failure_at = ${now},
        last_failure_at = ${now}, blocked_until = null`;
    return;
  }
  const failures = Number(row.failures) + 1;
  await sql`update login_attempts set failures = ${failures}, last_failure_at = ${now},
    blocked_until = ${failures >= LOGIN_LIMIT ? new Date(Date.now() + LOGIN_BLOCK_MS).toISOString() : null}
    where key = ${key}`;
};

export const clearLoginFailures = async (key: string): Promise<void> => {
  await sql`delete from login_attempts where key = ${key}`;
};
