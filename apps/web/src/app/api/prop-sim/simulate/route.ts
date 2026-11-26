import { simulate } from "@luxalgo/prop-firm-sim-core";
import { bad, handler, ok, requireValue } from "@/server/api";
import { propSimChallenges } from "@/server/prop-sim";

export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as {
    key?: string;
    winRate?: number;
    avgWinR?: number;
    tradesPerDay?: number;
    risk?: number;
    paths?: number;
    seed?: number;
  };
  requireValue(typeof body.key === "string", "Pilih firm dan challenge.");
  const challenges = await propSimChallenges();
  const challenge = challenges.find((item) => item.key === body.key);
  requireValue(Boolean(challenge), "Challenge tidak ditemukan atau tidak dapat disimulasikan.");

  const winRate = Number(body.winRate);
  const avgWinR = Number(body.avgWinR);
  const tradesPerDay = Number(body.tradesPerDay);
  const risk = Number(body.risk);
  const paths = Number(body.paths ?? 10_000);
  const seed = Number(body.seed ?? 42);
  requireValue(winRate > 0 && winRate < 1, "Win rate harus antara 0 dan 1.");
  requireValue(avgWinR > 0 && avgWinR <= 20, "Avg win R tidak valid.");
  requireValue(tradesPerDay > 0 && tradesPerDay <= 50, "Trades per day tidak valid.");
  requireValue(risk > 0 && risk <= 10, "Risk per trade harus 0–10%.");
  requireValue(paths >= 100 && paths <= 20_000, "Paths harus 100–20.000.");
  requireValue(Number.isFinite(seed), "Seed tidak valid.");

  const result = simulate(
    challenge!.spec,
    {
      kind: "parametric",
      winRate,
      avgWinR,
      avgLossR: 1,
      tradesPerDay,
      tradesPerDayModel: "fixed",
      risk: { mode: "percent-of-balance", value: risk / 100 },
    },
    { paths, seed, attemptCap: 25, simulateFunded: true, fundedHorizonDays: 90 },
  );

  return ok({
    challenge: {
      firm: challenge!.firm,
      name: challenge!.name,
      provenance: challenge!.provenance,
      inferredFields: challenge!.inferredFields,
    },
    passProbability: result.perAttempt.passProbability,
    passCi: result.perAttempt.passProbabilityCi,
    steps: result.perAttempt.steps,
    failureBreakdown: result.perAttempt.failureBreakdown,
    stagnationDays: result.perAttempt.stagnationDays,
    fundedProbability: result.journey.fundedProbability,
    cost: result.journey.cost,
    costGivenFunded: result.journey.costGivenFunded,
    daysToFunded: result.journey.daysToFunded,
    evTotal: result.ev.evTotal,
    evStandardError: result.ev.evStandardError,
    pPositive: result.ev.pPositive,
    payoutProbability: result.funded?.payoutProbability ?? null,
    blownProbability: result.funded?.blownProbability ?? null,
    assumptions: result.assumptions.flags,
  });
});
