import { sql } from "./pg";
import { getRanking, summarizeTrades } from "./ranking";
import { getPlaybookRules } from "./ai-context";
import { runAi } from "./ai";

export type PerformancePeriod = "week" | "month";

export interface PerformanceReport {
  title: string;
  subtitle: string;
  lines: string[];
  text: string;
  rank: number | null;
  period: PerformancePeriod;
  generatedAt: string;
}

/** Build (and, on first use, generate) an AI performance report for one account. */
export const buildPerformanceReport = async (
  userId: string,
  period: PerformancePeriod,
): Promise<PerformanceReport> => {
  const days = period === "week" ? 7 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
  const rows = await sql`select id, owner_id, category, symbol, mode, side, lot, entry,
    exit_price, stop_loss, take_profit, pnl, status, opened_at, closed_at, notes
    from cfd_trades where owner_id = ${userId} and opened_at >= ${since}
    order by opened_at desc`;
  const trades = rows as unknown as Parameters<typeof summarizeTrades>[0];
  const { metrics, edge, perMode } = summarizeTrades(trades);
  const ranking = await getRanking();
  const entry = ranking.find((item) => item.userId === userId);
  const rules = await getPlaybookRules(userId);

  const lines = [
    `Jendela: ${days} hari terakhir (${since.slice(0, 10)} s/d ${new Date().toISOString().slice(0, 10)}).`,
    `Total ${metrics.totalTrades} trade, ${metrics.closedTrades} selesai, ${metrics.wins} menang, ${metrics.losses} kalah.`,
    `Net P&L ${metrics.netPnl.toFixed(2)} USD; win rate ${metrics.winRate === null ? "n/a" : `${(metrics.winRate * 100).toFixed(1)}%`}; profit factor ${metrics.profitFactor?.toFixed(2) ?? "n/a"}; expectancy ${metrics.expectancy?.toFixed(2) ?? "n/a"}.`,
    `Edge Score ${edge.score ?? "n/a"} (komponen: ${Object.entries(edge.components)
      .map(([key, value]) => `${key} ${value.toFixed(0)}`)
      .join(", ")}).`,
    `Peringkat leaderboard saat ini: #${entry?.rank ?? "-"} dari ${ranking.length}.`,
    ...perMode.map(
      (mode) =>
        `${mode.label}: ${mode.closed} selesai, net ${mode.netPnl.toFixed(2)}, win ${mode.winRate === null ? "n/a" : `${(mode.winRate * 100).toFixed(0)}%`}, edge ${mode.edgeScore ?? "n/a"}.`,
    ),
    `Aturan playbook: ${rules || "tidak ada playbook tersimpan."}`,
  ];

  const text = await runAi(
    `Buat ringkasan performa trading ${days} hari terakhir dalam Bahasa Indonesia, maksimal 250 kata.
Data (sumber Supabase):
${lines.join("\n")}
Jelaskan: (1) apa yang sudah baik, (2) komponen Edge yang melemah dan mengapa berdasarkan angka, (3) tiga tindakan konkret untuk periode berikutnya. Jangan mengarang data di luar angka di atas.`,
    2500,
  );

  const generatedAt = new Date().toISOString();
  return {
    title: `Laporan Performa ${period === "week" ? "Mingguan" : "Bulanan"}`,
    subtitle: `Trade Jurnal by Artian Capital Group · ${generatedAt.slice(0, 10)}`,
    lines: [text, "", "--- Data statistik ---", ...lines],
    text,
    rank: entry?.rank ?? null,
    period,
    generatedAt,
  };
};
