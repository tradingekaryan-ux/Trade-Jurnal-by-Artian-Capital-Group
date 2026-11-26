import { desc, eq } from "drizzle-orm";
import { db, cfdTrades } from "@/db";
import { bad, handler, ok, requireValue } from "@/server/api";
import { newId, nowIso } from "@/server/ids";
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

export const GET = handler((request: Request) => {
  const modes = new URL(request.url).searchParams
    .get("mode")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const rows = db.select().from(cfdTrades).orderBy(desc(cfdTrades.openedAt)).all();
  return ok({
    trades: modes?.length ? rows.filter((row) => modes.includes(row.mode)) : rows,
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
  db.insert(cfdTrades)
    .values({
      id,
      accountId: typeof body.accountId === "string" ? body.accountId : null,
      category: spec.class,
      symbol: input.symbol,
      mode: input.mode,
      side: input.side,
      lot: input.lot,
      entry: input.entry,
      takeProfit: input.takeProfit ?? null,
      stopLoss: input.stopLoss ?? null,
      exitPrice: calc.exitPrice,
      resultMode: input.resultMode,
      manualPnl: input.manualPnl ?? null,
      usdPerPip: input.usdPerPip ?? null,
      leverage: input.leverage ?? null,
      pips: calc.pips,
      pnl: calc.pnl,
      riskReward: calc.riskReward,
      rMultiple: calc.rMultiple,
      status: calc.status,
      openedAt,
      closedAt:
        calc.status === "closed"
          ? body.closedAt
            ? validateDate(body.closedAt, "Closed at")
            : timestamp
          : null,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 100_000) : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();
  return ok({ id, ...calc }, { status: 201 });
});

export const PATCH = handler(async (request: Request) => {
  const body = (await request.json()) as Record<string, unknown>;
  requireValue(typeof body.id === "string" && body.id.length > 0, "Trade id is required.");
  const current = db.select().from(cfdTrades).where(eq(cfdTrades.id, body.id)).get();
  requireValue(Boolean(current), "Trade not found.");
  const merged = {
    ...current,
    ...body,
    exit: body.exit !== undefined ? body.exit : current!.exitPrice,
    manualPnl: body.manualPnl !== undefined ? body.manualPnl : current!.manualPnl,
    resultMode: body.resultMode !== undefined ? body.resultMode : current!.resultMode,
  };
  const input = parseInput(merged);
  const calc = calculateJournal(input);
  db.update(cfdTrades)
    .set({
      exitPrice: calc.exitPrice,
      resultMode: input.resultMode,
      manualPnl: input.manualPnl ?? null,
      usdPerPip: input.usdPerPip ?? null,
      leverage: input.leverage ?? null,
      pips: calc.pips,
      pnl: calc.pnl,
      riskReward: calc.riskReward,
      rMultiple: calc.rMultiple,
      status: calc.status,
      closedAt: calc.status === "closed" ? (current!.closedAt ?? nowIso()) : null,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 100_000) : current!.notes,
      updatedAt: nowIso(),
    })
    .where(eq(cfdTrades.id, body.id))
    .run();
  return ok({ id: body.id, ...calc });
});

export const DELETE = handler(async (request: Request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  requireValue(Boolean(id), "Trade id is required.");
  db.delete(cfdTrades).where(eq(cfdTrades.id, id!)).run();
  return ok({ deleted: true });
});
