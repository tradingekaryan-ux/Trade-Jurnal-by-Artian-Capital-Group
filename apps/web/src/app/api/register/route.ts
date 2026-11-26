import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { systemDb } from "@/db";
import { loginAttempts, users } from "@/db/system-schema";
import { AUTH_COOKIE, createSession, hashPassword, SESSION_MAX_AGE } from "@/server/auth";
import { bad, handler, ok, requireValue } from "@/server/api";
import { newId } from "@/server/ids";

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
    requireValue(
      /^[a-zA-Z0-9_-]{3,32}$/.test(username),
      "Username must be 3–32 letters, numbers, _ or -.",
    );
    requireValue(password.length >= 8, "Password must be at least 8 characters.");
    requireValue(password.length <= 200, "Password is too long.");

    const key = `register:${clientKey(request)}`;
    const prior = systemDb.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
    if (
      prior &&
      Date.parse(prior.firstFailureAt) > Date.now() - REGISTRATION_WINDOW_MS &&
      prior.failures >= REGISTRATION_LIMIT
    ) {
      return bad("Too many registrations from this network. Try again later.", 429);
    }

    const normalized = username.toLowerCase();
    const existing = systemDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.usernameNormalized, normalized))
      .get();
    if (existing) return bad("Username is already taken.", 409);

    const count = systemDb.select({ id: users.id }).from(users).all().length;
    const isAdmin = count === 0 || normalized === (process.env.ADMIN_USERNAME ?? "").toLowerCase();
    const id = newId();
    systemDb
      .insert(users)
      .values({
        id,
        username,
        usernameNormalized: normalized,
        passwordHash: hashPassword(password),
        isAdmin,
        createdAt: new Date().toISOString(),
      })
      .run();

    const now = new Date().toISOString();
    systemDb
      .insert(loginAttempts)
      .values({
        key,
        failures: (prior?.failures ?? 0) + 1,
        firstFailureAt: prior?.firstFailureAt ?? now,
        lastFailureAt: now,
      })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: {
          failures:
            prior && Date.parse(prior.firstFailureAt) > Date.now() - REGISTRATION_WINDOW_MS
              ? prior.failures + 1
              : 1,
          firstFailureAt:
            prior && Date.parse(prior.firstFailureAt) > Date.now() - REGISTRATION_WINDOW_MS
              ? prior.firstFailureAt
              : now,
          lastFailureAt: now,
        },
      })
      .run();

    const token = createSession(id);
    const jar = await cookies();
    jar.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return ok({ authenticated: true, username, isAdmin }, { status: 201 });
  },
  { public: true },
);
