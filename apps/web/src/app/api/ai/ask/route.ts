import {
  byDuration,
  byHour,
  byMistake,
  byPlaybook,
  bySymbol,
  byTag,
  byWeekday,
  computeMetrics,
  type BucketStats,
} from "@luxalgo/journal-core";
import { bad, handler, ok } from "@/server/api";
import { runAi } from "@/server/ai";
import { queryTrades } from "@/server/trades-query";
import { accountContext, readAiRequest } from "@/server/ai-scope";
import { buildJournalAiContext } from "@/server/ai-context";
import { currentUser } from "@/server/auth";

const bucketBlock = (title: string, buckets: BucketStats[]): string =>
  buckets.length === 0
    ? ""
    : `${title}:\n${buckets
        .map(
          (b) =>
            `  ${b.key}: ${b.trades} trades, net ${b.netPnl.toFixed(2)}, win ${b.winRate === null ? "n/a" : `${(b.winRate * 100).toFixed(0)}%`}`,
        )
        .join("\n")}\n`;

/** Short-lived cache so identical questions don't burn the daily quota. */
const answerCache = new Map<
  string,
  { answer: string; scope: { label: string; timeZone: string }; at: number }
>();
const CACHE_TTL = 5 * 60_000;
const CACHE_ENABLED = process.env.NODE_ENV !== "test";

/**
 * "Ask your journal" — natural-language questions answered from the trader's
 * own data: legacy aggregates plus Supabase journals, notes and playbooks.
 */
export const POST = handler(async (request: Request) => {
  const scope = readAiRequest(await request.json(), "question");
  const { question, timeZone, filters } = scope;
  let userId = "";
  try {
    userId = (await currentUser())?.id ?? "";
  } catch {
    // Offline/test environments have no Supabase session lookup.
  }
  const cacheKey = `${userId}:${JSON.stringify({ question, filters, timeZone })}`;
  const cached = CACHE_ENABLED ? answerCache.get(cacheKey) : undefined;
  if (cached && Date.now() - cached.at < CACHE_TTL)
    return ok({ answer: cached.answer, scope: cached.scope, cached: true });

  const { trades } = queryTrades(filters);
  let journal: Awaited<ReturnType<typeof buildJournalAiContext>> = {
    text: "",
    tradeCount: 0,
  };
  try {
    journal = await buildJournalAiContext(userId, {
      from: filters.from,
      to: filters.to,
    });
  } catch {
    // Supabase unavailable — legacy journal aggregates still work.
  }
  if (trades.length === 0 && journal.tradeCount === 0)
    return bad("No trades match the selected accounts and filters");
  const m = computeMetrics(trades, { timeZone });

  const context = [
    scope.context,
    accountContext(trades, scope),
    `Overall: net ${m.netPnl.toFixed(2)} over ${m.closedTrades} closed trades (${m.tradingDays} days), win rate ${m.winRate === null ? "n/a" : `${(m.winRate * 100).toFixed(1)}%`}, profit factor ${m.profitFactorIsInfinite ? "inf" : (m.profitFactor?.toFixed(2) ?? "n/a")}, avg win ${m.avgWin?.toFixed(2) ?? "n/a"}, avg loss ${m.avgLoss?.toFixed(2) ?? "n/a"}, max drawdown ${m.maxDrawdown.toFixed(2)}, day win rate ${m.dayWinRate === null ? "n/a" : `${(m.dayWinRate * 100).toFixed(0)}%`}, fees ${m.fees.toFixed(2)}.`,
    bucketBlock("By symbol (top 12)", bySymbol(trades).slice(0, 12)),
    bucketBlock("By weekday", byWeekday(trades, timeZone)),
    bucketBlock("By hour of open", byHour(trades, timeZone)),
    bucketBlock("By holding time", byDuration(trades)),
    bucketBlock("By tag", byTag(trades).slice(0, 12)),
    bucketBlock("By mistake", byMistake(trades).slice(0, 12)),
    bucketBlock("By playbook", byPlaybook(trades)),
    journal.text,
  ]
    .filter(Boolean)
    .join("\n");

  const answer = await runAi(
    `Answer the trader's question using ONLY this data from their own journal (aggregates, CF/Futures/Crypto/Stock trades, notebook, playbooks and progress). If the data
can't answer it, say exactly what's missing (e.g. "tag your trades' stops to get R stats").
Cite the numbers you used. Under 200 words.

${context}

Question: ${question}`,
  );

  if (CACHE_ENABLED) answerCache.set(cacheKey, { answer, scope: scope.scope, at: Date.now() });
  return ok({ answer, scope: scope.scope, cached: false });
});
