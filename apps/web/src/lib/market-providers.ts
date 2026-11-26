import type { Resolution } from "./market-data";

export interface CredentialField {
  key: string;
  label: string;
  environmentKey: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export type TradFiGroup = "Indeks" | "Komoditas" | "Forex";

export interface ProviderSymbol {
  value: string;
  label: string;
  group: TradFiGroup;
}

export interface ProviderInfo {
  id: string;
  name: string;
  mode: "credentials" | "public" | "csv";
  description: string;
  symbolHint: string;
  fields: CredentialField[];
  datasets?: { value: string; label: string }[];
  resolutions?: Resolution[];
  symbols?: ProviderSymbol[];
}

/**
 * Hyperliquid HIP-3 tradfi markets only: indices, commodities and forex.
 * The full `dex:ticker` name is required by the API and is case-sensitive.
 * Other HIP-3 categories (stocks, ETFs, pre-IPO, rates, crypto) are excluded.
 */
export const HYPERLIQUID_TRADFI_SYMBOLS: ProviderSymbol[] = [
  { value: "xyz:SP500", label: "S&P 500", group: "Indeks" },
  { value: "xyz:XYZ100", label: "US 100", group: "Indeks" },
  { value: "xyz:JP225", label: "Nikkei 225", group: "Indeks" },
  { value: "xyz:KR200", label: "KOSPI 200", group: "Indeks" },
  { value: "xyz:NIFTY", label: "NIFTY 50", group: "Indeks" },
  { value: "xyz:GOLD", label: "Gold", group: "Komoditas" },
  { value: "xyz:SILVER", label: "Silver", group: "Komoditas" },
  { value: "xyz:COPPER", label: "Copper", group: "Komoditas" },
  { value: "xyz:PLATINUM", label: "Platinum", group: "Komoditas" },
  { value: "xyz:PALLADIUM", label: "Palladium", group: "Komoditas" },
  { value: "xyz:CL", label: "WTI Crude Oil", group: "Komoditas" },
  { value: "xyz:BRENTOIL", label: "Brent Crude Oil", group: "Komoditas" },
  { value: "xyz:NATGAS", label: "Natural Gas", group: "Komoditas" },
  { value: "xyz:HO", label: "Heating Oil", group: "Komoditas" },
  { value: "xyz:EUR", label: "EUR / USD", group: "Forex" },
  { value: "xyz:JPY", label: "USD / JPY", group: "Forex" },
  { value: "xyz:GBP", label: "GBP / USD", group: "Forex" },
];

export const isTradFiSymbol = (value: unknown): value is string =>
  typeof value === "string" && HYPERLIQUID_TRADFI_SYMBOLS.some((item) => item.value === value);

export const MARKET_PROVIDERS: ProviderInfo[] = [
  {
    id: "hyperliquid",
    name: "Hyperliquid TradFi",
    mode: "public",
    description:
      "Candle HIP-3 (perpetual) dari Hyperliquid untuk indeks, komoditas, dan forex. Tanpa API key.",
    symbolHint:
      "Pilih simbol HIP-3 lengkap, misalnya xyz:SP500, xyz:GOLD, atau xyz:EUR. Simbol lain tidak didukung.",
    fields: [],
    symbols: HYPERLIQUID_TRADFI_SYMBOLS,
  },
  {
    id: "market-csv",
    name: "Market data CSV",
    mode: "csv",
    description:
      "File OHLCV lokal. Bukan data feed; dipakai hanya bila candle Hyperliquid tidak mencakup periode trade.",
    symbolHint:
      "Gunakan simbol dan resolusi persis seperti pada file yang diunggah. Pilih dataset bila ada beberapa file.",
    fields: [],
  },
];

export const providerInfo = (id: string) => MARKET_PROVIDERS.find((item) => item.id === id);
