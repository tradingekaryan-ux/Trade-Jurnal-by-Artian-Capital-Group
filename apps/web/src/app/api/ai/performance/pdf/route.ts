import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bad, handler } from "@/server/api";
import { currentUser } from "@/server/auth";
import { buildPerformanceReport, type PerformancePeriod } from "@/server/ai-performance";
import { buildReviewPdf } from "@/lib/export-review";

export const runtime = "nodejs";

export const GET = handler(async (request: Request) => {
  const user = await currentUser();
  if (!user) return bad("Unauthorized", 401);
  const period = new URL(request.url).searchParams.get("period");
  if (period !== "week" && period !== "month") return bad("Periode tidak valid.", 400);
  const report = await buildPerformanceReport(user.id, period as PerformancePeriod);
  const font = readFileSync(join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf"));
  // The Noto subset used by the PDF exporter has no markdown/emoji glyphs.
  const ascii = (value: string): string =>
    value
      .replace(/\*\*/g, "")
      .replace(/[—–]/g, "-")
      .replace(/×/g, "x")
      .replace(/→/g, "->")
      .replace(/[•·]/g, "-")
      .replace(/≥/g, ">=")
      .replace(/≤/g, "<=")
      .replace(/[^\x20-\x7E\n]/g, "");
  const bytes = await buildReviewPdf(
    {
      title: ascii(report.title),
      subtitle: ascii(report.subtitle),
      lines: report.lines.map(ascii),
    },
    font,
  );
  return new Response(new Uint8Array(bytes).buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="laporan-performa-${period}-${report.generatedAt.slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
