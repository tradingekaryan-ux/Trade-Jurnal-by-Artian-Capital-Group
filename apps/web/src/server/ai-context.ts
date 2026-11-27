import { sql } from "./pg";
import { summarizeTrades } from "./ranking";

export interface JournalAiContext {
  text: string;
  tradeCount: number;
}

type Row = Record<string, unknown>;

const list = (payload: Record<string, unknown[]>, key: string): Row[] =>
  Array.isArray(payload[key]) ? (payload[key] as Row[]) : [];

const textOf = (value: unknown, limit = 500): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);

/** Context from the Supabase-native journals + snapshot workspace tables. */
export const buildJournalAiContext = async (
  userId: string,
  range: { from?: string; to?: string } = {},
): Promise<JournalAiContext> => {
  const clauses: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  const param = (value: string) => `$${values.push(value)}`;
  clauses.push(`owner_id = ${param(userId)}`);
  if (range.from) clauses.push(`opened_at >= ${param(`${range.from}T00:00:00.000Z`)}`);
  if (range.to) clauses.push(`opened_at <= ${param(`${range.to}T23:59:59.999Z`)}`);
  const rows = await sql.unsafe(
    `select id, owner_id, category, symbol, mode, side, lot, entry, exit_price,
      stop_loss, take_profit, pnl, status, opened_at, closed_at, notes
      from cfd_trades where ${clauses.join(" and ")} order by opened_at desc limit 300`,
    values,
  );
  const [snapshot] =
    await sql`select payload from journal_snapshots where user_id = ${userId} limit 1`;
  const payload = (snapshot?.payload ?? {}) as Record<string, unknown[]>;
  const trades = rows as unknown as Parameters<typeof summarizeTrades>[0];
  const { metrics, edge, perMode } = summarizeTrades(trades);
  if (trades.length === 0 && list(payload, "notes").length === 0)
    return { text: "", tradeCount: 0 };

  const lines: string[] = [
    "Jurnal CFD/Futures/Crypto/Stock (sumber Supabase):",
    `  Total ${metrics.totalTrades} trade, ${metrics.closedTrades} selesai, net ${metrics.netPnl.toFixed(2)}, win rate ${metrics.winRate === null ? "n/a" : `${(metrics.winRate * 100).toFixed(1)}%`}, profit factor ${metrics.profitFactor?.toFixed(2) ?? "n/a"}, expectancy ${metrics.expectancy?.toFixed(2) ?? "n/a"}.`,
    `  Edge Score ${edge.score ?? "n/a"} (min. 5 trade selesai). Komponen: ${Object.entries(
      edge.components,
    )
      .map(([key, value]) => `${key} ${value.toFixed(0)}`)
      .join(", ")}.`,
  ];
  for (const mode of perMode)
    lines.push(
      `  ${mode.label}: ${mode.closed} selesai, net ${mode.netPnl.toFixed(2)}, win ${mode.winRate === null ? "n/a" : `${(mode.winRate * 100).toFixed(0)}%`}, edge ${mode.edgeScore ?? "n/a"}.`,
    );
  for (const trade of trades.slice(0, 25)) {
    const row = trade as unknown as Row;
    lines.push(
      `  ${String(row.opened_at).slice(0, 10)} ${String(row.symbol)} ${String(row.side)} ${String(row.mode)} entry ${String(row.entry)} exit ${String(row.exit_price ?? "-")} pnl ${String(row.pnl ?? 0)} status ${String(row.status)}${row.notes ? ` catatan: ${textOf(row.notes, 160)}` : ""}`,
    );
  }
  const notes = list(payload, "notes");
  if (notes.length)
    lines.push(
      `Notebook (${notes.length}): ${notes
        .slice(0, 12)
        .map((note) => `${textOf(note.title, 60)}: ${textOf(note.content, 180)}`)
        .join(" | ")}`,
    );
  const playbooks = list(payload, "playbooks");
  if (playbooks.length)
    lines.push(
      `Playbook (${playbooks.length}): ${playbooks
        .slice(0, 8)
        .map((book) => `${textOf(book.name, 60)} [${textOf(book.rulesJson, 400)}]`)
        .join(" | ")}`,
    );
  const rules = list(payload, "progress_rules");
  const checks = list(payload, "progress_checks");
  if (rules.length)
    lines.push(
      `Progress: ${rules.length} rutinitas, ${checks.filter((check) => check.done === true).length} checklist selesai. ${rules
        .slice(0, 8)
        .map((rule) => textOf(rule.title, 50))
        .join(", ")}`,
    );
  const missed = list(payload, "missed_trades");
  if (missed.length) lines.push(`Missed trades: ${missed.length} entri.`);

  return { text: lines.join("\n"), tradeCount: trades.length };
};

/** Playbook rules used by the automatic post-close debrief. */
export const getPlaybookRules = async (userId: string): Promise<string> => {
  const [snapshot] =
    await sql`select payload from journal_snapshots where user_id = ${userId} limit 1`;
  const payload = (snapshot?.payload ?? {}) as Record<string, unknown[]>;
  return list(payload, "playbooks")
    .slice(0, 5)
    .map((book) => `${textOf(book.name, 60)}: ${textOf(book.rulesJson, 700)}`)
    .join("\n");
};
