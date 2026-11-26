import { NextResponse } from "next/server";
import { runAsUser } from "@/db";
import { currentUser } from "./auth";

export class RequestError extends Error {}
export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RequestError(message);
}

export const ok = (data: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(data, { ...init, headers });
};

export const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/**
 * Route wrapper: verifies the session, pins the tenant database for the whole
 * handler, and returns uniform JSON errors. Passing `public` skips auth but
 * still applies tenant context when a valid session is present.
 */
export const handler =
  <A extends unknown[]>(
    fn: (...args: A) => Promise<Response> | Response,
    options: { public?: boolean } = {},
  ) =>
  async (...args: A): Promise<Response> => {
    try {
      const authDisabled = process.env.AUTH_DISABLED === "1";
      const user = await currentUser();
      // Legacy password-gate assertions still apply in tests that set JOURNAL_PASSWORD.
      const legacyGate = authDisabled && Boolean(process.env.JOURNAL_PASSWORD);
      if (!options.public && !user && (!authDisabled || legacyGate))
        return bad("Unauthorized", 401);
      const work = () => fn(...args);
      const userId = user?.id ?? (authDisabled ? "test-user" : null);
      return userId ? await runAsUser(userId, work) : await work();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      return NextResponse.json(
        { error: message },
        { status: error instanceof RequestError ? 400 : 500 },
      );
    }
  };
