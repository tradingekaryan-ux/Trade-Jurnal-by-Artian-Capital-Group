import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bad, handler } from "@/server/api";
import { getRanking } from "@/server/ranking";
import { buildRankingCertificate } from "@/lib/ranking-certificate";

export const runtime = "nodejs";

/** Public certificate: embeds the rank and journal stats at download time. */
export const GET = handler(
  async (request: Request) => {
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) return bad("userId diperlukan.", 400);
    const entries = await getRanking();
    const entry = entries.find((item) => item.userId === userId);
    if (!entry) return bad("Jurnal tidak ditemukan.", 404);

    const issuedAt = new Date().toISOString();
    const percent = (value: number | null) =>
      value === null ? "—" : `${(value * 100).toFixed(1)}%`;
    const number = (value: number | null, digits = 2) =>
      value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
    const font = readFileSync(join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf"));
    const pdf = await buildRankingCertificate(
      {
        rank: entry.rank,
        total: entries.length,
        journalName: entry.journalName,
        owner: entry.username,
        edgeScore: entry.edgeScore ?? 0,
        issuedAt,
        stats: [
          { label: "Total jurnal", value: String(entry.journals.length || 1) },
          { label: "Total trade", value: String(entry.totalTrades) },
          { label: "Trade selesai", value: String(entry.closedTrades) },
          { label: "Menang / kalah", value: `${entry.wins} / ${entry.losses}` },
          { label: "Win rate", value: percent(entry.winRate) },
          { label: "Net P&L (USD)", value: number(entry.netPnl) },
          { label: "Profit factor", value: number(entry.profitFactor) },
          { label: "Expectancy (USD)", value: number(entry.expectancy) },
        ],
      },
      font,
    );
    const filename = `ranking-${entry.username}-${issuedAt.slice(0, 10)}.pdf`;
    const body = new Uint8Array(pdf).buffer as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { public: true },
);
