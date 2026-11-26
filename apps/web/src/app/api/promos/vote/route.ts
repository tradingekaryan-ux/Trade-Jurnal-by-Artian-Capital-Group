import { handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import { voteSummary, type VoteSummary } from "@/server/votes";

export const GET = handler(async (request: Request) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const user = await currentUser();
  return ok({ votes: await voteSummary(ids, user?.id ?? null) });
});

export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Silakan login untuk memberi vote.");
  const body = (await request.json()) as { promoId?: string; value?: string };
  requireValue(typeof body.promoId === "string", "Promo id diperlukan.");
  requireValue(body.value === "working" || body.value === "not_working", "Vote tidak valid.");
  const promo = await sql`select id from promos where id = ${body.promoId!} limit 1`;
  requireValue(promo.length > 0, "Promo tidak ditemukan.");

  const id = newId();
  const timestamp = nowIso();
  await sql`insert into promo_votes (id, promo_id, user_id, value, created_at, updated_at)
    values (${id}, ${body.promoId!}, ${user!.id}, ${body.value}, ${timestamp}, ${timestamp})
    on conflict (promo_id, user_id) do update set value = ${body.value}, updated_at = ${timestamp}`;
  const summary = (await voteSummary([body.promoId!], user!.id))[body.promoId!]! as VoteSummary;
  return ok(summary);
});
