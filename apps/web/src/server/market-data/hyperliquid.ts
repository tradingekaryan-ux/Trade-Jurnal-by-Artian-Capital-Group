import { isTradFiSymbol } from "@/lib/market-providers";
import { MarketDataError, type MarketDataProvider } from "./provider";
import { array, number, readPostJson, record, result, validateBars, windows } from "./http";

const HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info";
const HEADERS = { "Content-Type": "application/json" };

/**
 * Hyperliquid HIP-3 candles, limited to tradfi markets: indices, commodities
 * and forex. HIP-3 coins are dex-prefixed and case-sensitive (xyz:GOLD).
 * Public endpoint: no API key, no broker credentials.
 */
export const hyperliquid: MarketDataProvider = {
  id: "hyperliquid",
  name: "Hyperliquid TradFi",
  environmentKey: "",

  async test() {
    const dexes = array(
      await readPostJson(HYPERLIQUID_INFO, { type: "perpDexs" }, HEADERS, undefined, {
        cache: false,
      }),
    );
    if (!dexes.length) throw new MarketDataError("Hyperliquid returned no perp DEX list.");
  },

  async history(request) {
    if (request.dataset)
      throw new MarketDataError(
        "Hyperliquid TradFi uses the built-in symbol list; leave the dataset blank.",
      );
    if (!isTradFiSymbol(request.symbol))
      throw new MarketDataError(
        "Only Hyperliquid HIP-3 indices, commodities and forex are supported. Choose a symbol from the list.",
      );

    const history = await windows(request, 5000, async (from, to, signal) => {
      const payload = await readPostJson(
        HYPERLIQUID_INFO,
        {
          type: "candleSnapshot",
          req: {
            coin: request.symbol,
            interval: request.resolution,
            startTime: from,
            endTime: to - 1,
          },
        },
        HEADERS,
        signal,
      );
      return validateBars(
        array(payload)
          .map(record)
          .map((row) => ({
            time: number(row.t),
            open: number(row.o),
            high: number(row.h),
            low: number(row.l),
            close: number(row.c),
            volume: number(row.v),
          })),
      );
    });

    return result(
      this.name,
      request,
      history.bars,
      history.truncated,
      [
        "Hyperliquid HIP-3 perpetual prices are quoted in USDC (treated as USD) and follow that venue's oracle methodology; no FX conversion is applied.",
        "Coverage starts when the HIP-3 market launched. Only the most recent candles are available from the public API.",
      ],
      "USD",
    );
  },
};
