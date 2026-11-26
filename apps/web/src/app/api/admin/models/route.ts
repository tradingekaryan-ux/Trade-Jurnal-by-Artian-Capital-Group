import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { canAccessAdmin } from "@/lib/roles";
import { isAiModelTier } from "@/lib/ai-settings";
import { sql } from "@/server/pg";
import { nowIso } from "@/server/ids";
import { getAiKeys } from "@/server/settings";

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
}

const adminOnly = async () => {
  const user = await currentUser();
  return Boolean(user && canAccessAdmin(user.role));
};

export const GET = handler(async () => {
  if (!(await adminOnly())) return bad("Forbidden", 403);
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
  if (!(await adminOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as {
    action?: string;
    models?: { id: string; tier?: string; enabled?: boolean; supportsPdf?: boolean }[];
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
