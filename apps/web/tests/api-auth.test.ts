import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "tj-auth-test-"));
process.env.JOURNAL_DATA_DIR = scratch;

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}));

const { systemDb } = await import("../src/db");
const { users } = await import("../src/db/system-schema");
const { handler, ok } = await import("../src/server/api");
const { createSession, hashPassword, verifyPassword, sessionToken } =
  await import("../src/server/auth");

const userId = "11111111-1111-4111-8111-111111111111";

beforeAll(() => {
  systemDb
    .insert(users)
    .values({
      id: userId,
      username: "trader",
      usernameNormalized: "trader",
      passwordHash: hashPassword("correct-horse"),
      isAdmin: false,
      createdAt: new Date().toISOString(),
    })
    .run();
});

beforeEach(() => vi.stubEnv("AUTH_DISABLED", ""));
afterEach(() => vi.unstubAllEnvs());

afterAll(() => {
  systemDb.$client.close();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("username/password session gate", () => {
  it("rejects a missing cookie before the handler runs", async () => {
    cookieValue = undefined;
    const action = vi.fn(() => ok({ secret: true }));
    expect((await handler(action)()).status).toBe(401);
    expect(action).not.toHaveBeenCalled();
  });

  it.skip("rejects a forged cookie", async () => {
    cookieValue = sessionToken("forged-id");
    expect((await handler(() => ok({ secret: true }))()).status).toBe(401);
  });

  it.skip("accepts a real session and pins the tenant database", async () => {
    cookieValue = await createSession(userId);
    const response = await handler(() => ok({ ok: true }))();
    expect(response.status).toBe(200);
  });

  it("lets public routes run without a session", async () => {
    cookieValue = undefined;
    expect((await handler(() => ok({ public: true }), { public: true })()).status).toBe(200);
  });

  it("hashes passwords with a salt and verifies them safely", () => {
    const first = hashPassword("same-password");
    const second = hashPassword("same-password");
    expect(first).not.toBe(second);
    expect(verifyPassword("same-password", first)).toBe(true);
    expect(verifyPassword("wrong", first)).toBe(false);
  });
});
