import { and, asc, eq } from "drizzle-orm";
import { db, currentUserId, SYSTEM_USER } from "@/db";
import { settings } from "@/db/schema";
import { decryptJson, encryptJson } from "./crypto";
import { newId, nowIso } from "./ids";
import { sql } from "./pg";
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

const savedUserKey = (): string | null => {
  const saved = getSetting("openrouterKeyEnc");
  if (!saved) return null;
  try {
    const value = decryptJson<unknown>(saved);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
};

/**
 * All usable keys, in priority order: the user's own key first, then every
 * global key from OPENROUTER_API_KEYS, then OPENROUTER_API_KEY. When one key
 * hits an auth/quota/rate-limit error the next key is tried automatically.
 */
export const getAiKeys = (): string[] => {
  const keys = [
    savedUserKey(),
    ...(process.env.OPENROUTER_API_KEYS?.split(",") ?? []),
    openRouterEnvironmentKey(),
  ];
  return [...new Set(keys.map((key) => key?.trim()).filter((key): key is string => Boolean(key)))];
};

export const getAiKey = (): string | null => getAiKeys()[0] ?? null;

export const setAiKey = (key: string | null): void => {
  if (key === null) deleteSetting("openrouterKeyEnc");
  else setSetting("openrouterKeyEnc", encryptJson(key.trim()));
};

export const getGlobalSetting = async (key: string): Promise<string | null> => {
  const rows = await sql`select value from global_settings where key = ${key} limit 1`;
  return rows[0]?.value ?? null;
};

export const setGlobalSetting = async (key: string, value: string): Promise<void> => {
  await sql`insert into global_settings (key, value) values (${key}, ${value})
    on conflict (key) do update set value = ${value}`;
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

export const listModels = async (): Promise<AiModel[]> => {
  const rows = await sql`select id, name, tier, context_length, supports_pdf, enabled,
    is_default, source from models where enabled = true order by name`;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tier: row.tier,
    contextLength: row.context_length,
    supportsPdf: Boolean(row.supports_pdf),
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.is_default),
    source: row.source,
  }));
};

export const getDefaultModel = async (): Promise<string> => {
  const saved = await getGlobalSetting("defaultModel");
  if (saved) return saved;
  const rows = await sql`select id from models where is_default = true limit 1`;
  return rows[0]?.id || process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
};

export const getAiModel = async (): Promise<string> =>
  getSetting("aiModel")?.trim() || (await getDefaultModel());

export const setAiModel = (model: string): void => setSetting("aiModel", model);

export const getAiQuotaLimit = async (): Promise<number> => {
  const raw = Number(await getGlobalSetting("aiQuota"));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_AI_QUOTA;
};

export const isPaidAllowed = async (): Promise<boolean> =>
  (await getGlobalSetting("paidAllowed")) === "true";

/** ---------- Daily quota (global DB, keyed by user + UTC date) ---------- */

export const getQuota = async () => {
  const day = nowIso().slice(0, 10);
  const userId = currentUserId();
  const rows =
    userId === SYSTEM_USER
      ? []
      : await sql`select requests from ai_usage where user_id = ${userId} and day = ${day} limit 1`;
  return { limit: await getAiQuotaLimit(), used: Number(rows[0]?.requests ?? 0), day };
};

export const consumeQuota = async (): Promise<void> => {
  const userId = currentUserId();
  if (userId === SYSTEM_USER || process.env.AUTH_DISABLED === "1") return;
  const day = nowIso().slice(0, 10);
  const limit = await getAiQuotaLimit();
  const rows =
    await sql`select id, requests from ai_usage where user_id = ${userId} and day = ${day} limit 1`;
  const row = rows[0];
  if (!row) {
    await sql`insert into ai_usage (id, user_id, day, requests, updated_at)
      values (${newId()}, ${userId}, ${day}, 1, ${nowIso()})`;
    return;
  }
  if (Number(row.requests) >= limit)
    throw new Error(
      `Kuota AI harian habis (${limit} permintaan per hari). Coba lagi besok atau gunakan kunci OpenRouter Anda sendiri di Settings.`,
    );
  await sql`update ai_usage set requests = ${Number(row.requests) + 1}, updated_at = ${nowIso()} where id = ${row.id}`;
};

export const aiConfigured = (): boolean => getAiKey() !== null;

export const getAiSettings = async (): Promise<AiSettingsPayload> => {
  const key = getAiKey();
  return {
    configured: key !== null,
    keySource: getSetting("openrouterKeyEnc") ? "saved" : key ? "environment" : "none",
    model: await getAiModel(),
    models: await listModels(),
    defaultModel: await getDefaultModel(),
    quota: await getQuota(),
    paidAllowed: await isPaidAllowed(),
    baseUrl: getOpenRouterBaseUrl(),
  };
};
