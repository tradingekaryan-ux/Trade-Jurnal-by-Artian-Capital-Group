import { bad, handler, ok, requireValue } from "@/server/api";
import { newId, nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import { currentUser } from "@/server/auth";
import { syncJournalsToLegacy } from "@/server/legacy-sync";
import { deleteJournalCascade, deleteTradeCascade } from "@/server/cascade";
import { getPlaybookRules, buildJournalAiContext } from "@/server/ai-context";
import { runAi } from "@/server/ai";
import {
  calculateJournal,
  instrumentFor,
  isEnabledJournalMode,
  isResultMode,
  type JournalInput,
  type JournalMode,
  type ResultMode,
} from "@/lib/cfd";

const numberField = (value: unknown, name: string, required = false): number | undefined => {
  if (value === undefined || value === null || value === "") {
    requireValue(!required, `${name} is required.`);
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  requireValue(Number.isFinite(parsed), `${name} must be a number.`);
  return parsed;
};

const parseInput = (body: Record<string, unknown>): JournalInput => {
  requireValue(
    isEnabledJournalMode(body.mode),
    "Pilih mode jurnal yang tersedia: CFD, Futures, Crypto Spot, Crypto Perpetual, atau US Stock.",
  );
  requireValue(body.side === "buy" || body.side === "sell", "Side must be buy or sell.");
  requireValue(typeof body.symbol === "string", "Choose an instrument.");
  const spec = instrumentFor(body.symbol);
  requireValue(Boolean(spec), "Instrument tidak dikenal. Pilih dari katalog ticker standar.");
  requireValue(isResultMode(body.resultMode), "Choose a result mode.");
  const lot = numberField(body.size ?? body.lot, "Size", true)!;
  const entry = numberField(body.entry, "Entry", true)!;
  requireValue(lot > 0, "Size must be greater than zero.");
  requireValue(entry > 0, "Entry must be greater than zero.");
  const mode = body.mode as JournalMode;
  const leverage = numberField(body.leverage, "Leverage");
  if (mode === "crypto-perp")
    requireValue(
      Boolean(leverage) && (leverage as number) > 0,
      "Leverage is required for crypto perpetuals.",
    );
  return {
    mode,
    side: body.side,
    symbol: body.symbol,
    lot,
    entry,
    exit: numberField(body.exit, "Exit"),
    takeProfit: numberField(body.takeProfit, "Take profit"),
    stopLoss: numberField(body.stopLoss, "Stop loss"),
    resultMode: body.resultMode as ResultMode,
    manualPnl: numberField(body.manualPnl, "Result"),
    leverage,
    usdPerPip: numberField(body.usdPerPip, "USD per pip"),
  };
};

const validateDate = (value: unknown, name: string): string => {
  requireValue(
    typeof value === "string" && !Number.isNaN(Date.parse(value)),
    `${name} is invalid.`,
  );
  return new Date(value as string).toISOString();
};

/** DB columns are snake_case; parseInput() only reads camelCase. */
const rowToInput = (row: Record<string, unknown>): Record<string, unknown> => ({
  id: row.id,
  mode: row.mode,
  side: row.side,
  symbol: row.symbol,
  lot: row.lot,
  entry: row.entry,
  takeProfit: row.take_profit,
  stopLoss: row.stop_loss,
  exit: row.exit_price,
  resultMode: row.result_mode,
  manualPnl: row.manual_pnl,
  leverage: row.leverage,
  usdPerPip: row.usd_per_pip,
  openedAt: row.opened_at,
  closedAt: row.closed_at,
  notes: row.notes,
});

export const GET = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const modes = new URL(request.url).searchParams
    .get("mode")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const rows = modes?.length
    ? await sql`select * from cfd_trades where owner_id = ${user!.id} and mode = any(${modes}::text[]) order by opened_at desc`
    : await sql`select * from cfd_trades where owner_id = ${user!.id} order by opened_at desc`;
  // The client expects camelCase; DB columns are snake_case.
  return ok({
    trades: rows.map((row) => ({
      id: row.id,
      category: row.category,
      symbol: row.symbol,
      mode: row.mode,
      side: row.side,
      lot: row.lot,
      entry: row.entry,
      takeProfit: row.take_profit,
      stopLoss: row.stop_loss,
      exitPrice: row.exit_price,
      resultMode: row.result_mode,
      manualPnl: row.manual_pnl,
      usdPerPip: row.usd_per_pip,
      leverage: row.leverage,
      pips: row.pips,
      pnl: row.pnl,
      riskReward: row.risk_reward,
      rMultiple: row.r_multiple,
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      notes: row.notes,
      imageUrls: row.image_urls,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
});

export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as Record<string, unknown>;
  requireValue(body && typeof body === "object", "Enter a valid trade.");
  const input = parseInput(body);
  const spec = instrumentFor(input.symbol)!;
  const openedAt = validateDate(body.openedAt ?? nowIso(), "Opened at");
  const calc = calculateJournal(input);
  const id = newId();
  const timestamp = nowIso();
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  await sql`insert into cfd_trades
    (id, owner_id, account_id, category, symbol, mode, side, lot, entry, take_profit,
     stop_loss, exit_price, result_mode, manual_pnl, usd_per_pip, leverage, pips, pnl,
     risk_reward, r_multiple, status, opened_at, closed_at, notes, image_urls, created_at, updated_at)
    values (${id}, ${user!.id}, ${typeof body.accountId === "string" ? body.accountId : null},
      ${spec.class}, ${input.symbol}, ${input.mode}, ${input.side}, ${input.lot}, ${input.entry},
      ${input.takeProfit ?? null}, ${input.stopLoss ?? null}, ${calc.exitPrice}, ${input.resultMode},
      ${input.manualPnl ?? null}, ${input.usdPerPip ?? null}, ${input.leverage ?? null},
      ${calc.pips}, ${calc.pnl}, ${calc.riskReward}, ${calc.rMultiple}, ${calc.status},
      ${openedAt},
      ${calc.status === "closed" ? (body.closedAt ? validateDate(body.closedAt, "Closed at") : timestamp) : null},
      ${typeof body.notes === "string" ? body.notes.slice(0, 100_000) : null}, '[]', ${timestamp}, ${timestamp})`;
  await syncJournalsToLegacy(user!.id);
  return ok({ id, ...calc }, { status: 201 });
});

export const PATCH = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const body = (await request.json()) as Record<string, unknown>;
  requireValue(typeof body.id === "string" && body.id.length > 0, "Trade id is required.");
  const found =
    await sql`select * from cfd_trades where id = ${body.id} and owner_id = ${user!.id} limit 1`;
  requireValue(found.length > 0, "Trade not found.");
  const current = found[0]!;
  const currentInput = rowToInput(current);
  const merged = { ...currentInput, ...body };
  const input = parseInput(merged);
  const calc = calculateJournal(input);
  await sql`update cfd_trades set
    symbol = ${input.symbol}, side = ${input.side}, mode = ${input.mode},
    lot = ${input.lot}, entry = ${input.entry},
    take_profit = ${input.takeProfit ?? null}, stop_loss = ${input.stopLoss ?? null},
    exit_price = ${calc.exitPrice}, result_mode = ${input.resultMode},
    manual_pnl = ${input.manualPnl ?? null}, usd_per_pip = ${input.usdPerPip ?? null},
    leverage = ${input.leverage ?? null}, pips = ${calc.pips}, pnl = ${calc.pnl},
    risk_reward = ${calc.riskReward}, r_multiple = ${calc.rMultiple}, status = ${calc.status},
    closed_at = ${calc.status === "closed" ? (current.closed_at ?? nowIso()) : null},
    notes = ${typeof body.notes === "string" ? body.notes.slice(0, 100_000) : current.notes},
    updated_at = ${nowIso()}
    where id = ${body.id} and owner_id = ${user!.id}`;

  // Best-effort debrief when a running trade is closed. It never blocks the save.
  if (current.status === "running" && calc.status === "closed") {
    try {
      const rules = await getPlaybookRules(user!.id);
      const context = await buildJournalAiContext(user!.id);
      const debrief = await runAi(
        `Tutup trade ini dan berikan debrief singkat (maks. 120 kata, Bahasa Indonesia).
Trade: ${current.symbol} ${current.side} ${current.mode}, entry ${current.entry}, exit ${calc.exitPrice}, pips ${calc.pips ?? "n/a"}, P&L ${calc.pnl ?? 0}, R ${calc.rMultiple ?? "n/a"}, result mode ${input.resultMode}.
Catatan trader: ${typeof body.notes === "string" ? body.notes.slice(0, 1000) : (current.notes ?? "-")}
Aturan playbook: ${rules || "tidak ada playbook"}
Konteks jurnal ringkas: ${context.text.slice(0, 2500)}
Tulis: (1) apakah aturan playbook diikuti, (2) satu kesalahan spesifik, (3) satu instruksi konkret untuk trade berikutnya. Jangan mengarang harga.`,
        1500,
      );
      await sql`update cfd_trades set
        notes = coalesce(nullif(notes, ''), '') || ${`\n\n## AI debrief (${nowIso().slice(0, 10)})\n${debrief}`},
        updated_at = ${nowIso()}
        where id = ${body.id} and owner_id = ${user!.id}`;
    } catch {
      // AI unavailable/quota exhausted — the trade itself is already saved.
    }
  }

  await syncJournalsToLegacy(user!.id);
  return ok({ id: body.id, ...calc });
});

export const DELETE = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const mode = params.get("mode");
  requireValue(Boolean(id) !== Boolean(mode), "Berikan id trade atau mode jurnal.");
  if (id) {
    const removed = await deleteTradeCascade(user!.id, id!);
    await syncJournalsToLegacy(user!.id);
    return ok({ deleted: true, scope: "trade", ...removed });
  }
  requireValue(isEnabledJournalMode(mode), "Mode jurnal tidak valid.");
  // Deleting a journal removes every trade and every image reference inside it.
  const removed = await deleteJournalCascade(user!.id, mode!);
  await syncJournalsToLegacy(user!.id);
  return ok({ deleted: true, scope: "journal", ...removed });
});
