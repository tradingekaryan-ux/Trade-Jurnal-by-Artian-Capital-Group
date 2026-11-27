import { handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { buildPerformanceReport, type PerformancePeriod } from "@/server/ai-performance";

export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const body = (await request.json()) as { period?: string };
  requireValue(body.period === "week" || body.period === "month", "Periode tidak valid.");
  const report = await buildPerformanceReport(user!.id, body.period as PerformancePeriod);
  return ok({
    text: report.text,
    rank: report.rank,
    period: report.period,
    generatedAt: report.generatedAt,
  });
});
