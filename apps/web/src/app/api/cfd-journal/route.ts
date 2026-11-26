import { bad, handler, ok, requireValue } from "@/server/api";
import { newId, nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import { currentUser } from "@/server/auth";
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
  requireValue(lot > 0, "Lot must be greater than zero.");
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
  return ok({ trades: rows });
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
  const merged = {
    ...current,
    ...body,
    exit: body.exit !== undefined ? body.exit : current.exit_price,
    manualPnl: body.manualPnl !== undefined ? body.manualPnl : current.manual_pnl,
    resultMode: body.resultMode !== undefined ? body.resultMode : current.result_mode,
  };
  const input = parseInput(merged);
  const calc = calculateJournal(input);
  await sql`update cfd_trades set
    exit_price = ${calc.exitPrice}, result_mode = ${input.resultMode},
    manual_pnl = ${input.manualPnl ?? null}, usd_per_pip = ${input.usdPerPip ?? null},
    leverage = ${input.leverage ?? null}, pips = ${calc.pips}, pnl = ${calc.pnl},
    risk_reward = ${calc.riskReward}, r_multiple = ${calc.rMultiple}, status = ${calc.status},
    closed_at = ${calc.status === "closed" ? (current.closed_at ?? nowIso()) : null},
    notes = ${typeof body.notes === "string" ? body.notes.slice(0, 100_000) : current.notes},
    updated_at = ${nowIso()}
    where id = ${body.id} and owner_id = ${user!.id}`;
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
    await sql`delete from cfd_trades where id = ${id} and owner_id = ${user!.id}`;
    return ok({ deleted: true, scope: "trade" });
  }
  requireValue(isEnabledJournalMode(mode), "Mode jurnal tidak valid.");
  // Deleting a journal removes every trade inside it, including their image references.
  const ids = await sql`select id from cfd_trades where owner_id = ${user!.id} and mode = ${mode}`;
  for (const row of ids)
    await sql`delete from image_attachments where owner_type = 'cfd-trade' and owner_ref = ${row.id} and owner_id = ${user!.id}`;
  await sql`delete from cfd_trades where owner_id = ${user!.id} and mode = ${mode}`;
  return ok({ deleted: true, scope: "journal", count: ids.length });
});
