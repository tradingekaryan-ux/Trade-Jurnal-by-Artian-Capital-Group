import { systemDb } from "@/db";
import { promoVotes } from "@/db/system-schema";

export interface VoteSummary {
  working: number;
  notWorking: number;
  mine: "working" | "not_working" | null;
}

export interface IdeaVoteSummary {
  stopLoss: number;
  takeProfit: number;
  mine: "stop_loss" | "take_profit" | null;
}

/** Vote tallies for a list of promos, including the caller's own vote. */
export function voteSummary(
  promoIds: string[],
  userId: string | null,
): Record<string, VoteSummary> {
  const result: Record<string, VoteSummary> = {};
  for (const id of promoIds) result[id] = { working: 0, notWorking: 0, mine: null };
  if (promoIds.length === 0) return result;
  for (const row of systemDb.select().from(promoVotes).all()) {
    const summary = result[row.promoId];
    if (!summary) continue;
    if (row.value === "working") summary.working += 1;
    if (row.value === "not_working") summary.notWorking += 1;
    if (userId && row.userId === userId) summary.mine = row.value as VoteSummary["mine"];
  }
  return result;
}

/** Vote tallies for trade ideas (same table, different value labels). */
export function ideaVoteSummary(
  ids: string[],
  userId: string | null,
): Record<string, IdeaVoteSummary> {
  const result: Record<string, IdeaVoteSummary> = {};
  for (const id of ids) result[id] = { stopLoss: 0, takeProfit: 0, mine: null };
  if (ids.length === 0) return result;
  for (const row of systemDb.select().from(promoVotes).all()) {
    const summary = result[row.promoId];
    if (!summary) continue;
    if (row.value === "stop_loss") summary.stopLoss += 1;
    if (row.value === "take_profit") summary.takeProfit += 1;
    if (userId && row.userId === userId) summary.mine = row.value as IdeaVoteSummary["mine"];
  }
  return result;
}
