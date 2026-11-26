import type { Resolution } from "./market-data";

export interface CredentialField {
  key: string;
  label: string;
  environmentKey: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
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
}

/** Only local CSV candles remain — no live price feed is used by this application. */
export const MARKET_PROVIDERS: ProviderInfo[] = [
  {
    id: "market-csv",
    name: "Market data CSV",
    mode: "csv",
    description: "File OHLCV lokal untuk replay. Bukan data feed harga realtime.",
    symbolHint: "Gunakan simbol dan resolusi persis sesuai file yang diunggah.",
    fields: [],
  },
];

export const providerInfo = (id: string) => MARKET_PROVIDERS.find((item) => item.id === id);
