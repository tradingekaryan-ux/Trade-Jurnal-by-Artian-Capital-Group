import { and, asc, eq } from "drizzle-orm";
import { db, currentUserId, SYSTEM_USER, systemDb } from "@/db";
import { settings } from "@/db/schema";
import { aiUsage, globalSettings, models } from "@/db/system-schema";
import { decryptJson, encryptJson } from "./crypto";
import { newId, nowIso } from "./ids";
import { EMPTY_DEFAULTS, type JournalDefaults } from "@/lib/journal-defaults";
import { DEFAULT_CONVERSION, parseCurrencyConversion } from "@/lib/currencies";
import {
  DEFAULT_AI_QUOTA,
  DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  type AiModel,
  type AiSettingsPayload,
} from "@/lib/ai-settings";

/** ---------- Tenant settings (stored in each user's journal database) ---------- */

export const getSetting = (key: string): string | null =>
  db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;

export const setSetting = (key: string, value: string): void => {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
};

export const deleteSetting = (key: string): void => {
  db.delete(settings).where(eq(settings.key, key)).run();
};

export const getJournalDefaults = (): JournalDefaults => {
  try {
    return { ...EMPTY_DEFAULTS, ...JSON.parse(getSetting("journalDefaults") ?? "{}") };
  } catch {
    return EMPTY_DEFAULTS;
  }
};

export const getCurrencyConversion = () => {
  const saved = getSetting("currencyConversion");
  if (!saved) return DEFAULT_CONVERSION;
  return parseCurrencyConversion(JSON.parse(saved));
};

export const getTimeZone = (): string => getSetting("timeZone") ?? "UTC";
export const getImportTimeZone = (): string => getSetting("importTimeZone") ?? getTimeZone();

export const getMultipliers = (): Record<string, number> => {
  const raw = getSetting("multipliers");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
};

/** ---------- OpenRouter connection (hybrid: per-user key or global env key) ---------- */

export const openRouterEnvironmentKey = (): string | null =>
  process.env.OPENROUTER_API_KEY?.trim() || null;

export const getAiKey = (): string | null => {
  const saved = getSetting("openrouterKeyEnc");
  if (saved) {
    try {
      const value = decryptJson<unknown>(saved);
      if (typeof value === "string" && value.trim()) return value.trim();
    } catch {
      // fall through to the environment key
    }
  }
  return openRouterEnvironmentKey();
};

export const setAiKey = (key: string | null): void => {
  if (key === null) deleteSetting("openrouterKeyEnc");
  else setSetting("openrouterKeyEnc", encryptJson(key.trim()));
};

export const getGlobalSetting = (key: string): string | null =>
  systemDb.select().from(globalSettings).where(eq(globalSettings.key, key)).get()?.value ?? null;

export const setGlobalSetting = (key: string, value: string): void => {
  systemDb
    .insert(globalSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: globalSettings.key, set: { value } })
    .run();
};

export const normalizeAiBaseUrl = (value: string): string | null => {
  if (value.length > 2048 || /[?#]/.test(value)) return null;
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
};

export const getOpenRouterBaseUrl = (): string =>
  normalizeAiBaseUrl(process.env.OPENROUTER_BASE_URL ?? "") ?? OPENROUTER_BASE_URL;

export const listModels = (): AiModel[] =>
  systemDb
    .select()
    .from(models)
    .where(eq(models.enabled, true))
    .orderBy(asc(models.name))
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      tier: row.tier,
      contextLength: row.contextLength,
      supportsPdf: row.supportsPdf,
      enabled: row.enabled,
      isDefault: row.isDefault,
      source: row.source,
    }));

export const getDefaultModel = (): string =>
  getGlobalSetting("defaultModel") ||
  systemDb.select().from(models).where(eq(models.isDefault, true)).get()?.id ||
  process.env.OPENROUTER_MODEL?.trim() ||
  DEFAULT_MODEL;

export const getAiModel = (): string => getSetting("aiModel")?.trim() || getDefaultModel();

export const setAiModel = (model: string): void => setSetting("aiModel", model);

export const getAiQuotaLimit = (): number => {
  const raw = Number(getGlobalSetting("aiQuota"));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_AI_QUOTA;
};

export const isPaidAllowed = (): boolean => getGlobalSetting("paidAllowed") === "true";

/** ---------- Daily quota (global DB, keyed by user + UTC date) ---------- */

export const getQuota = () => {
  const day = nowIso().slice(0, 10);
  const userId = currentUserId();
  const used =
    userId === SYSTEM_USER
      ? 0
      : (systemDb
          .select()
          .from(aiUsage)
          .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
          .get()?.requests ?? 0);
  return { limit: getAiQuotaLimit(), used, day };
};

/** Throws when the user has exhausted their daily allowance. */
export const consumeQuota = (): void => {
  const userId = currentUserId();
  if (userId === SYSTEM_USER || process.env.AUTH_DISABLED === "1") return;
  const day = nowIso().slice(0, 10);
  const limit = getAiQuotaLimit();
  systemDb.transaction((tx) => {
    const row = tx
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
      .get();
    if (!row) {
      tx.insert(aiUsage)
        .values({ id: newId(), userId, day, requests: 1, updatedAt: nowIso() })
        .run();
      return;
    }
    if (row.requests >= limit)
      throw new Error(
        `Kuota AI harian habis (${limit} permintaan per hari). Coba lagi besok atau gunakan kunci OpenRouter Anda sendiri di Settings.`,
      );
    tx.update(aiUsage)
      .set({ requests: row.requests + 1, updatedAt: nowIso() })
      .where(eq(aiUsage.id, row.id))
      .run();
  });
};

export const aiConfigured = (): boolean => getAiKey() !== null;

export const getAiSettings = (): AiSettingsPayload => {
  const key = getAiKey();
  return {
    configured: key !== null,
    keySource: getSetting("openrouterKeyEnc") ? "saved" : key ? "environment" : "none",
    model: getAiModel(),
    models: listModels(),
    defaultModel: getDefaultModel(),
    quota: getQuota(),
    paidAllowed: isPaidAllowed(),
    baseUrl: getOpenRouterBaseUrl(),
  };
};
