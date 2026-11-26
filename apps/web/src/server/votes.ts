import { sql } from "./pg";

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

const empty = (ids: string[]) => {
  const result: Record<
    string,
    {
      working: number;
      notWorking: number;
      stopLoss: number;
      takeProfit: number;
      mine: string | null;
    }
  > = {};
  for (const id of ids)
    result[id] = { working: 0, notWorking: 0, stopLoss: 0, takeProfit: 0, mine: null };
  return result;
};

export async function voteSummary(
  promoIds: string[],
  userId: string | null,
): Promise<Record<string, VoteSummary>> {
  if (promoIds.length === 0) return {};
  const rows = await sql`
    select promo_id, user_id, value from promo_votes where promo_id = ANY(${promoIds}::text[])
  `;
  const result: Record<string, VoteSummary> = {};
  for (const id of promoIds) result[id] = { working: 0, notWorking: 0, mine: null };
  for (const row of rows) {
    const summary = result[row.promo_id as string];
    if (!summary) continue;
    if (row.value === "working") summary.working += 1;
    if (row.value === "not_working") summary.notWorking += 1;
    if (userId && row.user_id === userId) summary.mine = row.value as VoteSummary["mine"];
  }
  return result;
}

export async function ideaVoteSummary(
  ids: string[],
  userId: string | null,
): Promise<Record<string, IdeaVoteSummary>> {
  if (ids.length === 0) return {};
  const rows = await sql`
    select promo_id, user_id, value from promo_votes where promo_id = ANY(${ids}::text[])
  `;
  const result: Record<string, IdeaVoteSummary> = {};
  for (const id of ids) result[id] = { stopLoss: 0, takeProfit: 0, mine: null };
  for (const row of rows) {
    const summary = result[row.promo_id as string];
    if (!summary) continue;
    if (row.value === "stop_loss") summary.stopLoss += 1;
    if (row.value === "take_profit") summary.takeProfit += 1;
    if (userId && row.user_id === userId) summary.mine = row.value as IdeaVoteSummary["mine"];
  }
  return result;
}
