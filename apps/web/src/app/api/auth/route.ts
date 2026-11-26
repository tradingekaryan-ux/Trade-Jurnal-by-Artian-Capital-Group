import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { systemDb } from "@/db";
import { users } from "@/db/system-schema";
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

export const GET = handler(async () => {
  const user = await currentUser();
  return ok({
    id: user?.id ?? null,
    authenticated: Boolean(user),
    username: user?.username ?? null,
    isAdmin: user?.isAdmin ?? false,
    role: user?.role ?? "member",
  });
});

export const POST = handler(
  async (request: Request) => {
    const body = (await request.json()) as AuthBody;
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) return bad("Username and password are required.", 401);

    const key = `login:${clientKey(request)}:${username}`;
    const blocked = loginBlockedFor(key);
    if (blocked > 0)
      return bad(`Too many attempts. Try again in ${Math.ceil(blocked / 60000)} minutes.`, 429);

    const user = systemDb.select().from(users).where(eq(users.usernameNormalized, username)).get();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordLoginFailure(key);
      return bad("Username atau password salah.", 401);
    }

    clearLoginFailures(key);
    systemDb
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run();
    const token = createSession(user.id);
    const jar = await cookies();
    jar.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return ok({
      authenticated: true,
      username: user.username,
      isAdmin: user.isAdmin,
      role: user.role,
    });
  },
  { public: true },
);

export const DELETE = handler(async (request: Request) => {
  const jar = await cookies();
  deleteSession(jar.get(AUTH_COOKIE)?.value);
  jar.set(AUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return ok({ authenticated: false });
});
