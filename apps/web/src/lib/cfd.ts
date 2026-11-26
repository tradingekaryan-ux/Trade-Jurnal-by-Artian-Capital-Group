import { HYPERLIQUID_TRADFI_SYMBOLS } from "./market-providers";

export type JournalMode = "cfd" | "futures" | "crypto-spot" | "crypto-perp" | "stock";
export type TradFiCategory =
  "forex" | "commodity" | "indice" | "stock" | "crypto-perp" | "crypto-spot";
export type ResultMode = "auto" | "manual" | "breakeven";

export interface InstrumentSpec {
  symbol: string;
  label: string;
  category: TradFiCategory;
  /** Price increment used for pips (CFD) or ticks (futures). */
  pipSize: number;
  /** USD profit per 1 pip for a 1-lot position. Editable by the user. */
  usdPerPipPerLot: number;
  note?: string;
}

/**
 * Contract references for the Hyperliquid tradfi feed. Values are sensible
 * defaults for risk sizing only — the user can override USD/pip/lot in the form.
 * Always verify the firm's own contract specification before trading.
 */
export const INSTRUMENTS: InstrumentSpec[] = [
  {
    symbol: "xyz:EUR",
    label: "EUR / USD",
    category: "forex",
    pipSize: 0.0001,
    usdPerPipPerLot: 10,
  },
  {
    symbol: "xyz:GBP",
    label: "GBP / USD",
    category: "forex",
    pipSize: 0.0001,
    usdPerPipPerLot: 10,
  },
  {
    symbol: "xyz:JPY",
    label: "USD / JPY",
    category: "forex",
    pipSize: 0.01,
    usdPerPipPerLot: 6.35,
    note: "JPY pip value is approximate; override with your broker's rate.",
  },
  { symbol: "xyz:GOLD", label: "Gold", category: "commodity", pipSize: 0.01, usdPerPipPerLot: 100 },
  {
    symbol: "xyz:SILVER",
    label: "Silver",
    category: "commodity",
    pipSize: 0.001,
    usdPerPipPerLot: 50,
  },
  {
    symbol: "xyz:COPPER",
    label: "Copper",
    category: "commodity",
    pipSize: 0.0001,
    usdPerPipPerLot: 25,
  },
  {
    symbol: "xyz:PLATINUM",
    label: "Platinum",
    category: "commodity",
    pipSize: 0.1,
    usdPerPipPerLot: 50,
  },
  {
    symbol: "xyz:PALLADIUM",
    label: "Palladium",
    category: "commodity",
    pipSize: 0.1,
    usdPerPipPerLot: 50,
  },
  {
    symbol: "xyz:CL",
    label: "WTI Crude Oil",
    category: "commodity",
    pipSize: 0.001,
    usdPerPipPerLot: 10,
  },
  {
    symbol: "xyz:BRENTOIL",
    label: "Brent Crude Oil",
    category: "commodity",
    pipSize: 0.001,
    usdPerPipPerLot: 10,
  },
  {
    symbol: "xyz:NATGAS",
    label: "Natural Gas",
    category: "commodity",
    pipSize: 0.0001,
    usdPerPipPerLot: 10,
  },
  {
    symbol: "xyz:HO",
    label: "Heating Oil",
    category: "commodity",
    pipSize: 0.0001,
    usdPerPipPerLot: 10,
  },
  { symbol: "xyz:SP500", label: "S&P 500", category: "indice", pipSize: 0.1, usdPerPipPerLot: 10 },
  { symbol: "xyz:XYZ100", label: "US 100", category: "indice", pipSize: 1, usdPerPipPerLot: 5 },
  { symbol: "xyz:JP225", label: "Nikkei 225", category: "indice", pipSize: 1, usdPerPipPerLot: 5 },
  {
    symbol: "xyz:KR200",
    label: "KOSPI 200",
    category: "indice",
    pipSize: 0.01,
    usdPerPipPerLot: 5,
  },
  { symbol: "xyz:NIFTY", label: "NIFTY 50", category: "indice", pipSize: 1, usdPerPipPerLot: 5 },
  { symbol: "xyz:NVDA", label: "NVIDIA", category: "stock", pipSize: 0.01, usdPerPipPerLot: 1 },
  { symbol: "xyz:MSFT", label: "Microsoft", category: "stock", pipSize: 0.01, usdPerPipPerLot: 1 },
  { symbol: "xyz:MU", label: "Micron", category: "stock", pipSize: 0.01, usdPerPipPerLot: 1 },
  { symbol: "xyz:INTC", label: "Intel", category: "stock", pipSize: 0.01, usdPerPipPerLot: 1 },
  { symbol: "xyz:TSLA", label: "Tesla", category: "stock", pipSize: 0.01, usdPerPipPerLot: 1 },
  { symbol: "xyz:SPCX", label: "SpaceX", category: "stock", pipSize: 0.01, usdPerPipPerLot: 1 },
  { symbol: "xyz:SKHX", label: "SK Hynix", category: "stock", pipSize: 0.01, usdPerPipPerLot: 1 },
  {
    symbol: "xyz:SOXL",
    label: "Semiconductor Bull 3X ETF",
    category: "stock",
    pipSize: 0.01,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "xyz:SMH",
    label: "Semiconductor ETF",
    category: "stock",
    pipSize: 0.01,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "BTC",
    label: "Bitcoin Perpetual",
    category: "crypto-perp",
    pipSize: 0.01,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "ETH",
    label: "Ethereum Perpetual",
    category: "crypto-perp",
    pipSize: 0.01,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "SOL",
    label: "Solana Perpetual",
    category: "crypto-perp",
    pipSize: 0.01,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "HYPE",
    label: "Hyperliquid Perpetual",
    category: "crypto-perp",
    pipSize: 0.01,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "XRP",
    label: "XRP Perpetual",
    category: "crypto-perp",
    pipSize: 0.0001,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "DOGE",
    label: "Dogecoin Perpetual",
    category: "crypto-perp",
    pipSize: 0.00001,
    usdPerPipPerLot: 1,
  },
  {
    symbol: "PURR/USDC",
    label: "Purr / USDC Spot",
    category: "crypto-spot",
    pipSize: 0.000001,
    usdPerPipPerLot: 1,
  },
];

/** Keep the catalog in sync with the market-data feed symbol list. */
export const tradFiSymbols = HYPERLIQUID_TRADFI_SYMBOLS.map((item) => item.value);
for (const spec of INSTRUMENTS) {
  if (!tradFiSymbols.includes(spec.symbol))
    throw new Error(`Instrument ${spec.symbol} is missing from the Hyperliquid symbol list.`);
}

export const instrumentFor = (symbol: string): InstrumentSpec | undefined =>
  INSTRUMENTS.find((item) => item.symbol === symbol);

export const MODE_LABELS: Record<JournalMode, string> = {
  cfd: "CFD (Pips)",
  futures: "Futures (Tick) — Coming soon",
  "crypto-spot": "Crypto Spot (%)",
  "crypto-perp": "Crypto Perpetual (% × Leverage)",
  stock: "US Stock Spot (%)",
};

export const isJournalMode = (value: unknown): value is JournalMode =>
  typeof value === "string" && Object.hasOwn(MODE_LABELS, value);

export const ENABLED_JOURNAL_MODES: JournalMode[] = ["cfd", "crypto-spot", "crypto-perp", "stock"];
export const isEnabledJournalMode = (value: unknown): value is JournalMode =>
  isJournalMode(value) && ENABLED_JOURNAL_MODES.includes(value);

/** Suggest a journal mode from the feed instrument category. */
export const modeForCategory = (category: TradFiCategory): JournalMode => {
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
  const perPip =
    finite(input.usdPerPip) && (input.usdPerPip as number) > 0
      ? (input.usdPerPip as number)
      : (spec?.usdPerPipPerLot ?? 10);

  const hasExit = finite(input.exit) && (input.exit as number) > 0;
  const hasResult = input.resultMode === "breakeven" || finite(input.manualPnl);
  const status: "running" | "closed" = hasExit || hasResult ? "closed" : "running";
  if (status === "running")
    return { status, pips: null, pnl: null, exitPrice: null, riskReward: null, rMultiple: null };

  let pnl = 0;
  let effectiveExit: number | null = hasExit ? (input.exit as number) : null;
  let move: number; // pips for cfd, ticks for futures, percent-points for % modes

  if (input.resultMode === "manual" && finite(input.manualPnl)) {
    pnl = input.manualPnl as number;
    // Derive a display-only pips/ticks/percent move from the entered USD result.
    if (input.mode === "cfd" || input.mode === "futures") move = pnl / (perPip * (input.lot || 1));
    else move = pnl / (input.lot * (input.mode === "crypto-perp" ? (input.leverage ?? 1) : 1));
  } else if (input.resultMode === "breakeven") {
    pnl = 0;
    move = 0;
  } else if (hasExit) {
    const difference = direction * ((input.exit as number) - input.entry);
    if (input.mode === "cfd") {
      move = difference / (spec?.pipSize ?? 0.0001);
      pnl = move * perPip * input.lot;
    } else if (input.mode === "futures") {
      move = difference / (spec?.pipSize ?? 1);
      pnl = move * (spec?.usdPerPipPerLot ?? 1) * input.lot;
    } else {
      move = difference / input.entry;
      const leverage = input.mode === "crypto-perp" ? (input.leverage ?? 1) : 1;
      pnl = input.lot * move * leverage;
    }
  } else {
    move = 0;
  }

  // For manual results with no exit price, derive a display-only exit.
  if (effectiveExit === null && input.entry > 0 && move !== 0) {
    if (input.mode === "cfd" || input.mode === "futures") {
      const step = input.mode === "cfd" ? (spec?.pipSize ?? 0.0001) : (spec?.pipSize ?? 1);
      effectiveExit = input.entry + direction * move * step;
    } else {
      effectiveExit = input.entry * (1 + direction * move);
    }
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
      ? ((stopDistance ?? 0) / (spec?.pipSize ?? 0.0001)) * perPip * input.lot
      : input.lot *
        ((stopDistance ?? 0) / input.entry) *
        (input.mode === "crypto-perp" ? (input.leverage ?? 1) : 1);
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
