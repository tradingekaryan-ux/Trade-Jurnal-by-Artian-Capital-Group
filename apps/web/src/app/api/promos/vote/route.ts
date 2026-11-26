import { and, eq } from "drizzle-orm";
import { systemDb } from "@/db";
import { promoVotes, promos } from "@/db/system-schema";
import { handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { voteSummary, type VoteSummary } from "@/server/votes";

export const GET = handler(async (request: Request) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const user = await currentUser();
  return ok({ votes: voteSummary(ids, user?.id ?? null) });
});

export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Silakan login untuk memberi vote.");
  const body = (await request.json()) as { promoId?: string; value?: string };
  requireValue(typeof body.promoId === "string", "Promo id diperlukan.");
  requireValue(body.value === "working" || body.value === "not_working", "Vote tidak valid.");
  const promo = systemDb
    .select({ id: promos.id })
    .from(promos)
    .where(eq(promos.id, body.promoId!))
    .get();
  requireValue(Boolean(promo), "Promo tidak ditemukan.");

  const existing = systemDb
    .select()
    .from(promoVotes)
    .where(and(eq(promoVotes.promoId, body.promoId!), eq(promoVotes.userId, user!.id)))
    .get();
  if (existing) {
    systemDb
      .update(promoVotes)
      .set({ value: body.value, updatedAt: nowIso() })
      .where(eq(promoVotes.id, existing.id))
      .run();
  } else {
    const timestamp = nowIso();
    systemDb
      .insert(promoVotes)
      .values({
        id: newId(),
        promoId: body.promoId!,
        userId: user!.id,
        value: body.value,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  }
  const summary = voteSummary([body.promoId!], user!.id)[body.promoId!]! as VoteSummary;
  return ok(summary);
});
