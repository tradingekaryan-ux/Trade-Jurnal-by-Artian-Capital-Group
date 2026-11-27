import { INSTRUMENTS, instrumentFor, type InstrumentClass } from "./instruments";

export type JournalMode = "cfd" | "futures" | "crypto-spot" | "crypto-perp" | "stock";
export type TradFiCategory = InstrumentClass;
export type ResultMode = "auto" | "manual" | "breakeven";

export { INSTRUMENTS, instrumentFor };
export const isInstrumentSymbol = (value: unknown): value is string =>
  typeof value === "string" && INSTRUMENTS.some((item) => item.symbol === value);

export const MODE_LABELS: Record<JournalMode, string> = {
  cfd: "CFD (Pips)",
  futures: "Futures (Tick)",
  "crypto-spot": "Crypto Spot (%)",
  "crypto-perp": "Crypto Perpetual (% × Leverage)",
  stock: "US Stock Spot (%)",
};

export const SIZE_LABEL: Record<JournalMode, string> = {
  cfd: "Lot",
  futures: "Qty (Kontrak)",
  "crypto-spot": "Nilai Beli (USD)",
  "crypto-perp": "Nilai Beli (USD)",
  stock: "Nilai Beli (USD)",
};

export const SIZE_UNIT: Record<JournalMode, string> = {
  cfd: "LOT",
  futures: "QTY",
  "crypto-spot": "USD",
  "crypto-perp": "USD",
  stock: "USD",
};

export const formatTradeSize = (mode: string, size: number): string => {
  const unit = isJournalMode(mode) ? SIZE_UNIT[mode] : "LOT";
  if (unit === "USD") {
    return `${size.toLocaleString("en-US", { maximumFractionDigits: 2 })} USD`;
  }
  return `${Number(size.toFixed(4))} ${unit}`;
};

export const formatTradeMove = (mode: string, pips: number | null): string => {
  if (pips === null) return "—";
  const val = pips.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (mode === "cfd") return `${val} pips`;
  if (mode === "futures") return `${val} tick`;
  return `${val}%`;
};

export const isJournalMode = (value: unknown): value is JournalMode =>
  typeof value === "string" && Object.hasOwn(MODE_LABELS, value);

export const ENABLED_JOURNAL_MODES: JournalMode[] = [
  "cfd",
  "futures",
  "crypto-spot",
  "crypto-perp",
  "stock",
];
export const isEnabledJournalMode = (value: unknown): value is JournalMode =>
  isJournalMode(value) && ENABLED_JOURNAL_MODES.includes(value);

export const modeForCategory = (category: TradFiCategory): JournalMode => {
  if (category === "futures") return "futures";
  if (category === "crypto-spot") return "crypto-spot";
  if (category === "crypto-perp") return "crypto-perp";
  if (category === "stock") return "stock";
  return "cfd";
};

export const isResultMode = (value: unknown): value is ResultMode =>
  value === "auto" || value === "manual" || value === "breakeven";

export interface JournalInput {
  mode: JournalMode;
  side: "buy" | "sell";
  symbol: string;
  lot: number;
  entry: number;
  exit?: number | null;
  takeProfit?: number | null;
  stopLoss?: number | null;
  resultMode: ResultMode;
  manualPnl?: number | null;
  leverage?: number | null;
  usdPerPip?: number | null;
}

export interface JournalCalculation {
  status: "running" | "closed";
  pips: number | null;
  pnl: number | null;
  exitPrice: number | null;
  riskReward: number | null;
  rMultiple: number | null;
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Pure calculation shared by the form preview and the API. No IO. */
export function calculateJournal(input: JournalInput): JournalCalculation {
  const direction = input.side === "buy" ? 1 : -1;
  const spec = instrumentFor(input.symbol);
  const perUnit =
    finite(input.usdPerPip) && (input.usdPerPip as number) > 0
      ? (input.usdPerPip as number)
      : (spec?.value ?? 1);
  const step = spec?.step ?? 0.0001;

  const hasExit = finite(input.exit) && (input.exit as number) > 0;
  const hasResult = input.resultMode === "breakeven" || finite(input.manualPnl);
  const status: "running" | "closed" = hasExit || hasResult ? "closed" : "running";
  if (status === "running")
    return { status, pips: null, pnl: null, exitPrice: null, riskReward: null, rMultiple: null };

  let pnl = 0;
  let effectiveExit: number | null = hasExit ? (input.exit as number) : null;
  let move: number; // pips / ticks / percent-point, depending on mode

  if (input.resultMode === "manual" && finite(input.manualPnl)) {
    pnl = input.manualPnl as number;
    if (input.mode === "cfd" || input.mode === "futures") move = pnl / (perUnit * (input.lot || 1));
    else
      // Percentage modes use `lot` as the USD notional entered by the user.
      // For perpetuals this is the post-leverage notional, so no extra factor.
      move = pnl / (input.lot || 1);
  } else if (input.resultMode === "breakeven") {
    pnl = 0;
    move = 0;
  } else if (hasExit) {
    const difference = direction * ((input.exit as number) - input.entry);
    if (input.mode === "cfd") {
      move = difference / step;
      pnl = move * perUnit * input.lot;
    } else if (input.mode === "futures") {
      move = difference / step;
      pnl = move * perUnit * input.lot;
    } else {
      move = difference / input.entry;
      // `lot` is the USD notional: entry cash for stock/spot, post-leverage
      // exposure for crypto perpetuals. Leverage is informational only here.
      pnl = input.lot * move;
    }
  } else {
    move = 0;
  }

  if (effectiveExit === null && input.entry > 0 && move !== 0) {
    effectiveExit =
      input.mode === "cfd" || input.mode === "futures"
        ? input.entry + direction * move * step
        : input.entry * (1 + direction * move);
  }

  const stopDistance = finite(input.stopLoss)
    ? Math.abs((input.stopLoss as number) - input.entry)
    : null;
  const targetDistance = finite(input.takeProfit)
    ? Math.abs((input.takeProfit as number) - input.entry)
    : null;
  const riskReward =
    stopDistance && stopDistance > 0 && targetDistance !== null
      ? targetDistance / stopDistance
      : null;
  const riskAmount =
    input.mode === "cfd" || input.mode === "futures"
      ? ((stopDistance ?? 0) / step) * perUnit * input.lot
      : input.lot * ((stopDistance ?? 0) / input.entry);
  const rMultiple = riskAmount > 0 ? pnl / riskAmount : null;

  return {
    status,
    pips: Number(move.toFixed(4)),
    pnl: Number(pnl.toFixed(2)),
    exitPrice: effectiveExit,
    riskReward,
    rMultiple,
  };
}
