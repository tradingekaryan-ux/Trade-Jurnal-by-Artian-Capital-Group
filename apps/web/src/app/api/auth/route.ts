import { cookies } from "next/headers";
import {
  AUTH_COOKIE,
  clearLoginFailures,
  createSession,
  currentUser,
  deleteSession,
  loginBlockedFor,
  recordLoginFailure,
  SESSION_MAX_AGE,
  verifyPassword,
} from "@/server/auth";
import { bad, handler, ok } from "@/server/api";
import { sql } from "@/server/pg";

interface AuthBody {
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

export const GET = handler(
  async () => {
    const user = await currentUser();
    return ok({
      id: user?.id ?? null,
      authenticated: Boolean(user),
      username: user?.username ?? null,
      isAdmin: user?.isAdmin ?? false,
      role: user?.role ?? "member",
    });
  },
  { public: true },
);

export const POST = handler(
  async (request: Request) => {
    const body = (await request.json()) as AuthBody;
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) return bad("Username and password are required.", 401);

    const key = `login:${clientKey(request)}:${username}`;
    const blocked = await loginBlockedFor(key);
    if (blocked > 0)
      return bad(`Too many attempts. Try again in ${Math.ceil(blocked / 60000)} minutes.`, 429);

    const found = await sql`select id, username, password_hash, role, is_admin
      from users where username_normalized = ${username} limit 1`;
    const user = found[0];
    if (!user || !verifyPassword(password, String(user.password_hash))) {
      await recordLoginFailure(key);
      return bad("Username atau password salah.", 401);
    }

    await clearLoginFailures(key);
    await sql`update users set last_login_at = ${new Date().toISOString()} where id = ${user.id}`;
    const token = await createSession(user.id);
    const jar = await cookies();
    jar.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return ok({
      authenticated: true,
      username: user.username,
      isAdmin: Boolean(user.is_admin),
      role: user.role,
    });
  },
  { public: true },
);

export const DELETE = handler(
  async (request: Request) => {
    const jar = await cookies();
    await deleteSession(jar.get(AUTH_COOKIE)?.value);
    jar.set(AUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return ok({ authenticated: false });
  },
  { public: true },
);
