import { cookies } from "next/headers";
import { AUTH_COOKIE, createSession, hashPassword, SESSION_MAX_AGE } from "@/server/auth";
import { bad, handler, ok, requireValue } from "@/server/api";
import { newId } from "@/server/ids";
import { sql } from "@/server/pg";
import type { UserRole } from "@/lib/roles";

const REGISTRATION_LIMIT = 3;
const REGISTRATION_WINDOW_MS = 60 * 60_000;

interface RegisterBody {
  username?: string;
  password?: string;
}

const clientKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local").slice(
    0,
    200,
  );
};

export const POST = handler(
  async (request: Request) => {
    const body = (await request.json()) as RegisterBody;
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    requireValue(/^[a-zA-Z0-9_-]{3,32}$/.test(username), "Username tidak valid.");
    requireValue(password.length >= 8 && password.length <= 200, "Password minimal 8 karakter.");

    const key = `register:${clientKey(request)}`;
    const priorRows =
      await sql`select failures, first_failure_at from login_attempts where key = ${key} limit 1`;
    const prior = priorRows[0];
    if (
      prior &&
      Date.parse(String(prior.first_failure_at)) > Date.now() - REGISTRATION_WINDOW_MS &&
      Number(prior.failures) >= REGISTRATION_LIMIT
    ) {
      return bad("Terlalu banyak registrasi. Coba lagi nanti.", 429);
    }

    const normalized = username.toLowerCase();
    const existing =
      await sql`select id from users where username_normalized = ${normalized} limit 1`;
    if (existing.length) return bad("Username sudah dipakai.", 409);

    // Owner tidak boleh ditentukan dari "user pertama" di deployment dengan
    // Supabase — siapa pun bisa mendaftar lebih dulu. Provision owner memakai
    // scripts/setup-owner.mjs (OWNER_USERNAME / OWNER_PASSWORD) atau Admin panel.
    const allowBootstrapOwner =
      !process.env.DATABASE_URL || process.env.ALLOW_FIRST_USER_OWNER === "1";
    const countRows = allowBootstrapOwner ? await sql`select count(*)::int as n from users` : [];
    const role: UserRole =
      allowBootstrapOwner && Number(countRows[0]?.n ?? 0) === 0 ? "owner" : "member";
    const id = newId();
    const now = new Date().toISOString();
    await sql`insert into users (id, username, username_normalized, password_hash, is_admin, role, created_at)
      values (${id}, ${username}, ${normalized}, ${hashPassword(password)}, ${role === "owner"}, ${role}, ${now})`;

    const failures =
      prior && Date.parse(String(prior.first_failure_at)) > Date.now() - REGISTRATION_WINDOW_MS
        ? Number(prior.failures) + 1
        : 1;
    const firstFailure =
      prior && Date.parse(String(prior.first_failure_at)) > Date.now() - REGISTRATION_WINDOW_MS
        ? String(prior.first_failure_at)
        : now;
    await sql`insert into login_attempts (key, failures, first_failure_at, last_failure_at)
      values (${key}, ${failures}, ${firstFailure}, ${now})
      on conflict (key) do update set failures = ${failures},
        first_failure_at = ${firstFailure}, last_failure_at = ${now}`;

    const token = await createSession(id);
    const jar = await cookies();
    jar.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return ok({ authenticated: true, username, isAdmin: role === "owner", role }, { status: 201 });
  },
  { public: true },
);
