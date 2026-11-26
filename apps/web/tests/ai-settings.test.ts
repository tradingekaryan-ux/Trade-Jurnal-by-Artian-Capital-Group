import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "tj-ai-test-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, runAsUser, systemDb } = await import("../src/db");
const { settings } = await import("../src/db/schema");
const { models, users } = await import("../src/db/system-schema");
const {
  getAiKey,
  getAiModel,
  getAiSettings,
  getDefaultModel,
  setAiKey,
  setAiModel,
  setGlobalSetting,
  consumeQuota,
} = await import("../src/server/settings");
const { runAi } = await import("../src/server/ai");

const USER = "33333333-3333-4333-8333-333333333333";
const inUser = <T>(work: () => T) => runAsUser(USER, work);

beforeAll(() => {
  systemDb
    .insert(users)
    .values({
      id: USER,
      username: "ai-test",
      usernameNormalized: "ai-test",
      passwordHash: "unused",
      isAdmin: false,
      createdAt: new Date().toISOString(),
    })
    .run();
});

beforeEach(() => {
  inUser(() => db.delete(settings).run());
  systemDb.delete(models).run();
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("AUTH_DISABLED", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected provider request");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
afterAll(() => {
  db.$client.close();
  systemDb.$client.close();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("OpenRouter settings", () => {
  it("is unconfigured without an environment or saved key", async () => {
    await inUser(async () => {
      expect(getAiKey()).toBeNull();
      expect(getAiSettings().configured).toBe(false);
      await expect(runAi("fixture")).rejects.toThrow("AI is not configured");
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("uses the server key and reports its source", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-env");
    inUser(() => {
      expect(getAiKey()).toBe("sk-or-env");
      expect(getAiSettings().keySource).toBe("environment");
    });
  });

  it("prefers the user's encrypted key over the server key", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-env");
    inUser(() => {
      setAiKey("sk-or-user");
      expect(getAiKey()).toBe("sk-or-user");
      expect(getAiSettings().keySource).toBe("saved");
      const raw = JSON.stringify(db.select().from(settings).all());
      expect(raw).not.toContain("sk-or-user");
    });
  });

  it("reads the default model from the admin catalog and stores a per-user override", () => {
    systemDb
      .insert(models)
      .values({
        id: "openai/gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        tier: "free",
        enabled: true,
        isDefault: true,
        source: "admin",
        updatedAt: new Date().toISOString(),
      })
      .run();
    inUser(() => {
      expect(getDefaultModel()).toBe("openai/gpt-4.1-mini");
      expect(getAiModel()).toBe("openai/gpt-4.1-mini");
      setAiModel("google/gemini-2.5-flash");
      expect(getAiModel()).toBe("google/gemini-2.5-flash");
      expect(getAiSettings().models).toHaveLength(1);
    });
  });

  it("enforces the daily request quota", () => {
    setGlobalSetting("aiQuota", "1");
    inUser(() => {
      expect(() => consumeQuota()).not.toThrow();
      expect(() => consumeQuota()).toThrow("Kuota AI harian habis");
    });
  });
});
