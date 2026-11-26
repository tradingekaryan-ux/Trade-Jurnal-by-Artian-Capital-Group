import { handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import { ideaVoteSummary, type IdeaVoteSummary } from "@/server/votes";

export const GET = handler(async (request: Request) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const user = await currentUser();
  return ok({ votes: await ideaVoteSummary(ids, user?.id ?? null) });
});

export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Silakan login untuk memberi vote.");
  const body = (await request.json()) as { ideaId?: string; value?: string };
  requireValue(typeof body.ideaId === "string", "Idea id diperlukan.");
  requireValue(body.value === "stop_loss" || body.value === "take_profit", "Vote tidak valid.");
  const idea = await sql`select id from promos where id = ${body.ideaId!} limit 1`;
  requireValue(idea.length > 0, "Trade idea tidak ditemukan.");

  const id = newId();
  const timestamp = nowIso();
  await sql`insert into promo_votes (id, promo_id, user_id, value, created_at, updated_at)
    values (${id}, ${body.ideaId!}, ${user!.id}, ${body.value}, ${timestamp}, ${timestamp})
    on conflict (promo_id, user_id) do update set value = ${body.value}, updated_at = ${timestamp}`;
  const summary = (await ideaVoteSummary([body.ideaId!], user!.id))[
    body.ideaId!
  ]! as IdeaVoteSummary;
  return ok(summary);
});
