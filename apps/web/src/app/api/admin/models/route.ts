import { eq } from "drizzle-orm";
import { systemDb } from "@/db";
import { models } from "@/db/system-schema";
import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import {
  getAiKeys,
  getAiQuotaLimit,
  getDefaultModel,
  getGlobalSetting,
  getOpenRouterBaseUrl,
  isPaidAllowed,
  setGlobalSetting,
} from "@/server/settings";
import { nowIso } from "@/server/ids";
import { isAiModelTier } from "@/lib/ai-settings";

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
}

const adminOnly = async () => {
  const user = await currentUser();
  return Boolean(user?.isAdmin);
};

export const GET = handler(async () => {
  if (!(await adminOnly())) return bad("Forbidden", 403);
  return ok({
    models: systemDb.select().from(models).all(),
    defaultModel: getDefaultModel(),
    quota: getAiQuotaLimit(),
    paidAllowed: isPaidAllowed(),
    lastSync: getGlobalSetting("lastModelSync"),
  });
});

export const POST = handler(async (request: Request) => {
  if (!(await adminOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as {
    action?: string;
    models?: {
      id: string;
      tier?: string;
      enabled?: boolean;
      isDefault?: boolean;
      supportsPdf?: boolean;
    }[];
    defaultModel?: string;
    quota?: number;
    paidAllowed?: boolean;
  };
  requireValue(body && typeof body === "object", "Invalid request.");

  if (body.action === "sync") {
    const keys = getAiKeys();
    requireValue(keys.length > 0, "Kunci OpenRouter belum tersedia di server.");
    let response: Response | null = null;
    for (const key of keys) {
      const candidate = await fetch(`${getOpenRouterBaseUrl()}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (candidate.ok) {
        response = candidate;
        break;
      }
      if (![401, 402, 403, 429].includes(candidate.status))
        return bad(`Gagal mengambil daftar model OpenRouter (${candidate.status}).`, 502);
    }
    requireValue(response, "Semua kunci OpenRouter gagal saat mengambil daftar model.");
    const payload = (await response.json()) as { data?: OpenRouterModel[] };
    const incoming = payload.data ?? [];
    requireValue(incoming.length > 0, "OpenRouter tidak mengembalikan model apa pun.");

    systemDb.transaction((tx) => {
      const overrides = new Set(
        tx
          .select()
          .from(models)
          .where(eq(models.source, "admin"))
          .all()
          .map((row) => row.id),
      );
      tx.delete(models).where(eq(models.source, "openrouter")).run();
      for (const item of incoming) {
        if (overrides.has(item.id)) continue;
        const free =
          Number(item.pricing?.prompt ?? 1) === 0 && Number(item.pricing?.completion ?? 1) === 0;
        const pdfCapable =
          /^(openai\/gpt-4|google\/gemini|anthropic\/claude|meta-llama\/.*vision)/i.test(item.id);
        tx.insert(models)
          .values({
            id: item.id,
            name: item.name || item.id,
            tier: free ? "free" : "paid",
            contextLength: item.context_length ?? null,
            supportsPdf: pdfCapable,
            enabled: true,
            isDefault: false,
            source: "openrouter",
            updatedAt: nowIso(),
          })
          .onConflictDoNothing()
          .run();
      }
    });
    setGlobalSetting("lastModelSync", nowIso());
    return ok({ synced: incoming.length });
  }

  if (body.action === "save") {
    systemDb.transaction((tx) => {
      if (body.defaultModel) {
        tx.update(models).set({ isDefault: false }).run();
        tx.update(models).set({ isDefault: true }).where(eq(models.id, body.defaultModel)).run();
      }
      for (const update of body.models ?? []) {
        requireValue(
          typeof update.id === "string" && update.id.length <= 200,
          "Model ID tidak valid.",
        );
        const existing = tx.select().from(models).where(eq(models.id, update.id)).get();
        if (!existing) continue;
        if (update.tier !== undefined)
          requireValue(isAiModelTier(update.tier), "Tier tidak valid.");
        tx.update(models)
          .set({
            ...(update.tier !== undefined ? { tier: update.tier } : {}),
            ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
            ...(update.supportsPdf !== undefined ? { supportsPdf: update.supportsPdf } : {}),
            ...(update.tier !== undefined ||
            update.enabled !== undefined ||
            update.supportsPdf !== undefined
              ? { source: "admin" }
              : {}),
            updatedAt: nowIso(),
          })
          .where(eq(models.id, update.id))
          .run();
      }
    });
    if (body.defaultModel) setGlobalSetting("defaultModel", body.defaultModel);
    if (body.quota !== undefined) {
      requireValue(
        Number.isInteger(body.quota) &&
          (body.quota as number) > 0 &&
          (body.quota as number) <= 1000,
        "Kuota harus antara 1 dan 1000.",
      );
      setGlobalSetting("aiQuota", String(body.quota));
    }
    if (body.paidAllowed !== undefined)
      setGlobalSetting("paidAllowed", body.paidAllowed ? "true" : "false");
    return ok({ saved: true });
  }

  return bad("Unknown action.");
});
