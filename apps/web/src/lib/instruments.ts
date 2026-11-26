export type InstrumentClass =
  "forex" | "commodity" | "indice" | "futures" | "crypto-spot" | "crypto-perp" | "stock";

export interface InstrumentSpec {
  symbol: string;
  label: string;
  class: InstrumentClass;
  /** Pip/point size for CFD, tick size for futures. */
  step: number;
  /** USD per pip (CFD) or USD per tick (futures). For % modes this is unused. */
  value: number;
  tier?: "standard" | "mini" | "micro" | "nano";
}

/** Standard market tickers — no venue-specific or HIP-3 prefixed symbols. */
export const INSTRUMENTS: InstrumentSpec[] = [
  { symbol: "EURUSD", label: "Euro / US Dollar", class: "forex", step: 0.0001, value: 10 },
  { symbol: "GBPUSD", label: "Pound / US Dollar", class: "forex", step: 0.0001, value: 10 },
  { symbol: "USDJPY", label: "US Dollar / Yen", class: "forex", step: 0.01, value: 6.35 },
  { symbol: "AUDUSD", label: "Aussie / US Dollar", class: "forex", step: 0.0001, value: 10 },
  { symbol: "USDCAD", label: "US Dollar / Loonie", class: "forex", step: 0.0001, value: 10 },
  { symbol: "USDCHF", label: "US Dollar / Swiss Franc", class: "forex", step: 0.0001, value: 10 },
  { symbol: "NZDUSD", label: "Kiwi / US Dollar", class: "forex", step: 0.0001, value: 10 },

  { symbol: "XAUUSD", label: "Gold / US Dollar", class: "commodity", step: 0.01, value: 1 },
  { symbol: "XAGUSD", label: "Silver / US Dollar", class: "commodity", step: 0.001, value: 1 },
  { symbol: "XCUUSD", label: "Copper / US Dollar", class: "commodity", step: 0.0001, value: 1 },
  { symbol: "WTIUSD", label: "WTI Crude Oil", class: "commodity", step: 0.001, value: 1 },
  { symbol: "BRENTUSD", label: "Brent Crude Oil", class: "commodity", step: 0.001, value: 1 },
  { symbol: "NATGAS", label: "Natural Gas", class: "commodity", step: 0.0001, value: 1 },
  { symbol: "XPTUSD", label: "Platinum / US Dollar", class: "commodity", step: 0.01, value: 1 },
  { symbol: "XPDUSD", label: "Palladium / US Dollar", class: "commodity", step: 0.01, value: 1 },

  { symbol: "US30", label: "Dow Jones Industrial Average", class: "indice", step: 1, value: 1 },
  { symbol: "US100", label: "Nasdaq 100", class: "indice", step: 1, value: 1 },
  { symbol: "US500", label: "S&P 500", class: "indice", step: 0.1, value: 10 },
  { symbol: "JP225", label: "Nikkei 225", class: "indice", step: 1, value: 1 },
  { symbol: "DE40", label: "DAX 40", class: "indice", step: 1, value: 1 },
  { symbol: "UK100", label: "FTSE 100", class: "indice", step: 1, value: 1 },
  { symbol: "AU200", label: "ASX 200", class: "indice", step: 1, value: 1 },
  { symbol: "IN50", label: "NIFTY 50", class: "indice", step: 1, value: 1 },

  {
    symbol: "SPX",
    label: "S&P 500 Futures (Standard)",
    class: "futures",
    tier: "standard",
    step: 0.25,
    value: 50,
  },
  {
    symbol: "NDX",
    label: "Nasdaq 100 Futures (Standard)",
    class: "futures",
    tier: "standard",
    step: 0.25,
    value: 50,
  },
  {
    symbol: "ES",
    label: "E-mini S&P 500",
    class: "futures",
    tier: "mini",
    step: 0.25,
    value: 12.5,
  },
  {
    symbol: "NQ",
    label: "E-mini Nasdaq 100",
    class: "futures",
    tier: "mini",
    step: 0.25,
    value: 5,
  },
  {
    symbol: "RTY",
    label: "E-mini Russell 2000",
    class: "futures",
    tier: "mini",
    step: 0.1,
    value: 5,
  },
  {
    symbol: "MES",
    label: "Micro E-mini S&P 500",
    class: "futures",
    tier: "micro",
    step: 0.25,
    value: 1.25,
  },
  {
    symbol: "MNQ",
    label: "Micro E-mini Nasdaq 100",
    class: "futures",
    tier: "micro",
    step: 0.25,
    value: 0.5,
  },
  {
    symbol: "MRTY",
    label: "Micro E-mini Russell 2000",
    class: "futures",
    tier: "micro",
    step: 0.1,
    value: 0.5,
  },
  {
    symbol: "MGC",
    label: "Micro Gold Futures",
    class: "futures",
    tier: "micro",
    step: 0.1,
    value: 1,
  },
  {
    symbol: "MCL",
    label: "Micro WTI Crude Futures",
    class: "futures",
    tier: "micro",
    step: 0.01,
    value: 1,
  },
  {
    symbol: "SPXN",
    label: "Nano S&P 500 Futures",
    class: "futures",
    tier: "nano",
    step: 0.25,
    value: 0.25,
  },
  {
    symbol: "NQ100N",
    label: "Nano Nasdaq 100 Futures",
    class: "futures",
    tier: "nano",
    step: 0.25,
    value: 0.25,
  },

  { symbol: "BTCUSD", label: "Bitcoin Spot", class: "crypto-spot", step: 0.01, value: 1 },
  { symbol: "ETHUSD", label: "Ethereum Spot", class: "crypto-spot", step: 0.01, value: 1 },
  { symbol: "SOLUSD", label: "Solana Spot", class: "crypto-spot", step: 0.001, value: 1 },
  { symbol: "XRPUSD", label: "XRP Spot", class: "crypto-spot", step: 0.0001, value: 1 },
  { symbol: "DOGEUSD", label: "Dogecoin Spot", class: "crypto-spot", step: 0.00001, value: 1 },

  { symbol: "BTCUSDT", label: "Bitcoin Perpetual", class: "crypto-perp", step: 0.01, value: 1 },
  { symbol: "ETHUSDT", label: "Ethereum Perpetual", class: "crypto-perp", step: 0.01, value: 1 },
  { symbol: "SOLUSDT", label: "Solana Perpetual", class: "crypto-perp", step: 0.001, value: 1 },
  { symbol: "XRPUSDT", label: "XRP Perpetual", class: "crypto-perp", step: 0.0001, value: 1 },
  {
    symbol: "DOGEUSDT",
    label: "Dogecoin Perpetual",
    class: "crypto-perp",
    step: 0.00001,
    value: 1,
  },

  { symbol: "NVDA", label: "NVIDIA", class: "stock", step: 0.01, value: 1 },
  { symbol: "MSFT", label: "Microsoft", class: "stock", step: 0.01, value: 1 },
  { symbol: "AAPL", label: "Apple", class: "stock", step: 0.01, value: 1 },
  { symbol: "TSLA", label: "Tesla", class: "stock", step: 0.01, value: 1 },
  { symbol: "MU", label: "Micron", class: "stock", step: 0.01, value: 1 },
  { symbol: "INTC", label: "Intel", class: "stock", step: 0.01, value: 1 },
  { symbol: "AMD", label: "AMD", class: "stock", step: 0.01, value: 1 },
  { symbol: "META", label: "Meta Platforms", class: "stock", step: 0.01, value: 1 },
  { symbol: "GOOGL", label: "Alphabet", class: "stock", step: 0.01, value: 1 },
  { symbol: "AMZN", label: "Amazon", class: "stock", step: 0.01, value: 1 },
];

export const instrumentFor = (symbol: string): InstrumentSpec | undefined =>
  INSTRUMENTS.find((item) => item.symbol === symbol);
export const isInstrumentSymbol = (value: unknown): value is string =>
  typeof value === "string" && INSTRUMENTS.some((item) => item.symbol === value);
export const instrumentsFor = (...classes: InstrumentClass[]) =>
  INSTRUMENTS.filter((item) => classes.includes(item.class));
