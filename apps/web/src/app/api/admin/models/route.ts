import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { canAccessAdmin, canManageSite } from "@/lib/roles";
import { isAiModelTier } from "@/lib/ai-settings";
import { sql } from "@/server/pg";
import { nowIso } from "@/server/ids";
import { getAiKeys, getGlobalSetting } from "@/server/settings";

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
}

const privileged = async () => {
  const user = await currentUser();
  return Boolean(user && canAccessAdmin(user.role));
};

/** Only the owner may change the model catalog, quota, or sync from OpenRouter. */
const ownerOnly = async () => {
  const user = await currentUser();
  return Boolean(user && canManageSite(user.role));
};

const validModelId = (value: string) =>
  value.length >= 2 && value.length <= 200 && /^[a-zA-Z0-9._:/-]+$/.test(value);

/** `:free`, `/free` and `-free` suffixes are treated as free models. */
const inferTier = (id: string): "free" | "paid" =>
  /(:free$|\/free$|-free(?::|$))/i.test(id) ? "free" : "paid";

export const GET = handler(async () => {
  if (!(await privileged())) return bad("Forbidden", 403);
  const [models, settings] = await Promise.all([
    sql`select * from models order by name`,
    sql`select key, value from global_settings`,
  ]);
  const map = new Map(settings.map((row) => [row.key, row.value]));
  return ok({
    models,
    defaultModel: map.get("defaultModel") ?? "",
    quota: Number(map.get("aiQuota") ?? 10),
    paidAllowed: map.get("paidAllowed") === "true",
    lastSync: map.get("lastModelSync") ?? null,
  });
});

export const POST = handler(async (request: Request) => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as {
    action?: string;
    ids?: string;
    id?: string;
    name?: string;
    tier?: string;
    contextLength?: number;
    supportsPdf?: boolean;
    models?: { id: string; tier?: string; enabled?: boolean; supportsPdf?: boolean }[];
    defaultModel?: string;
    quota?: number;
    paidAllowed?: boolean;
  };
  requireValue(body && typeof body === "object", "Invalid request.");

  if (body.action === "add") {
    const raw =
      typeof body.ids === "string" ? body.ids : typeof body.id === "string" ? body.id : "";
    const ids = [
      ...new Set(
        raw
          .split(/[\n,]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    requireValue(ids.length > 0 && ids.length <= 200, "Masukkan 1–200 model ID.");
    for (const id of ids) requireValue(validModelId(id), `Model ID tidak valid: ${id}`);
    if (body.tier !== undefined) requireValue(isAiModelTier(body.tier), "Tier tidak valid.");
    let added = 0;
    let skipped = 0;
    for (const id of ids) {
      const result = await sql`insert into models
        (id, name, tier, context_length, supports_pdf, enabled, is_default, source, updated_at)
        values (${id}, ${body.name?.trim() || id}, ${body.tier ?? inferTier(id)},
          ${body.contextLength ?? null}, ${body.supportsPdf ?? false}, true, false, 'admin', ${nowIso()})
        on conflict (id) do nothing`;
      if (Number((result as { count?: number }).count ?? 0) > 0) added++;
      else skipped++;
    }
    return ok({ added, skipped });
  }

  if (body.action === "remove") {
    requireValue(typeof body.id === "string" && validModelId(body.id), "Model ID tidak valid.");
    const result = await sql`delete from models where id = ${body.id!}`;
    const removed = Number((result as { count?: number }).count ?? 0);
    if (removed > 0 && (await getGlobalSetting("defaultModel")) === body.id)
      await sql`delete from global_settings where key = 'defaultModel'`;
    return ok({ removed });
  }

  if (body.action === "sync") {
    const keys = await getAiKeys();
    requireValue(keys.length > 0, "Kunci OpenRouter belum tersedia di server.");
    let response: Response | null = null;
    for (const key of keys) {
      const candidate = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (candidate.ok) {
        response = candidate;
        break;
      }
      if (![401, 402, 403, 429].includes(candidate.status))
        return bad(`Gagal mengambil daftar model OpenRouter (${candidate.status}).`, 502);
    }
    requireValue(response, "Semua kunci OpenRouter gagal.");
    const payload = (await response!.json()) as { data?: OpenRouterModel[] };
    const incoming = payload.data ?? [];
    requireValue(incoming.length > 0, "OpenRouter tidak mengembalikan model.");

    await sql`delete from models where source = 'openrouter'`;
    for (const item of incoming) {
      const free =
        Number(item.pricing?.prompt ?? 1) === 0 && Number(item.pricing?.completion ?? 1) === 0;
      const pdfCapable =
        /^(openai\/gpt-4|google\/gemini|anthropic\/claude|meta-llama\/.*vision)/i.test(item.id);
      await sql`insert into models
        (id, name, tier, context_length, supports_pdf, enabled, is_default, source, updated_at)
        values (${item.id}, ${item.name || item.id}, ${free ? "free" : "paid"},
          ${item.context_length ?? null}, ${pdfCapable}, true, false, 'openrouter', ${nowIso()})
        on conflict (id) do nothing`;
    }
    await sql`insert into global_settings (key, value) values ('lastModelSync', ${nowIso()})
      on conflict (key) do update set value = ${nowIso()}`;
    return ok({ synced: incoming.length });
  }

  if (body.action === "save") {
    if (body.defaultModel) {
      await sql`update models set is_default = false`;
      await sql`update models set is_default = true where id = ${body.defaultModel}`;
      await sql`insert into global_settings (key, value) values ('defaultModel', ${body.defaultModel})
        on conflict (key) do update set value = ${body.defaultModel}`;
    }
    for (const item of body.models ?? []) {
      requireValue(typeof item.id === "string" && item.id.length <= 200, "Model ID tidak valid.");
      if (item.tier !== undefined) requireValue(isAiModelTier(item.tier), "Tier tidak valid.");
      await sql`update models set
        tier = coalesce(${item.tier ?? null}::text, tier),
        enabled = coalesce(${item.enabled === undefined ? null : item.enabled}::boolean, enabled),
        supports_pdf = coalesce(${item.supportsPdf === undefined ? null : item.supportsPdf}::boolean, supports_pdf),
        source = 'admin', updated_at = ${nowIso()}
        where id = ${item.id}`;
    }
    if (body.quota !== undefined) {
      requireValue(
        Number.isInteger(body.quota) && body.quota > 0 && body.quota <= 1000,
        "Kuota tidak valid.",
      );
      await sql`insert into global_settings (key, value) values ('aiQuota', ${String(body.quota)})
        on conflict (key) do update set value = ${String(body.quota)}`;
    }
    if (body.paidAllowed !== undefined)
      await sql`insert into global_settings (key, value) values ('paidAllowed', ${body.paidAllowed ? "true" : "false"})
        on conflict (key) do update set value = ${body.paidAllowed ? "true" : "false"}`;
    return ok({ saved: true });
  }

  return bad("Unknown action.");
});
