import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildReviewPdf } from "../src/lib/export-review";

it("builds an ASCII-only performance report PDF with the Noto font", async () => {
  const font = readFileSync(new URL("../public/fonts/NotoSans-Regular.ttf", import.meta.url));
  const bytes = await buildReviewPdf(
    {
      title: "Laporan Performa Mingguan",
      subtitle: "Trade Jurnal by Artian Capital Group - 2026-11-27",
      lines: [
        "Ringkasan 7 hari terakhir.",
        "Net P&L 213.26 USD, win rate 75%, profit factor 2.78.",
        "- Edge Score 68.43",
        "- CF journal: 57.54",
      ],
    },
    font,
  );
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(1000);
});
