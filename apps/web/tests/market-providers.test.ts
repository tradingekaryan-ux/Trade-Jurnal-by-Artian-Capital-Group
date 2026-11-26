import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { marketTransport } from "../src/server/market-data/transport";
import { hyperliquid } from "../src/server/market-data/hyperliquid";
import { parseMarketCsv } from "../src/lib/market-csv";
import { MAX_PAGES, readPostJson } from "../src/server/market-data/http";

const from = Date.parse("2025-03-03T14:30:00Z");
const request = {
  from,
  to: from + 120_000,
  symbol: "xyz:SP500",
  resolution: "1m" as const,
};
const hlCandle = (time: number) => ({
  t: time,
  T: time + 59_999,
  s: "xyz:SP500",
  i: "1m",
  o: "100",
  h: "105",
  l: "95",
  c: "102",
  v: "4",
  n: 10,
});

afterEach(() => {
  vi.unstubAllGlobals();
  marketTransport.clear();
});
beforeEach(() => marketTransport.clear());

describe("Hyperliquid TradFi adapter", () => {
  it("rejects symbols outside indices, commodities and forex without a request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const symbol of ["BTC", "xyz:NVDA", "xyz:10Y", "xyz:SP500 "]) {
      await expect(hyperliquid.history({ ...request, symbol }, "")).rejects.toThrow(
        "Only Hyperliquid HIP-3 indices, commodities and forex",
      );
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requests the full HIP-3 coin and normalizes string candles", async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        type: string;
        req: { coin: string; interval: string; startTime: number; endTime: number };
      };
      expect(body.type).toBe("candleSnapshot");
      expect(body.req).toMatchObject({ coin: "xyz:SP500", interval: "1m" });
      return Response.json([hlCandle(from), hlCandle(from + 60_000)]);
    });
    vi.stubGlobal("fetch", fetcher);
    const data = await hyperliquid.history({ ...request, symbol: "xyz:SP500" }, "");
    expect(data.provider).toBe("Hyperliquid TradFi");
    expect(data.quoteCurrency).toBe("USD");
    expect(data.bars).toHaveLength(2);
    expect(data.bars[0]).toMatchObject({
      time: from,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 4,
    });
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.hyperliquid.xyz/info");
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: "POST" });
  });

  it("paginates at the 5000-candle API cap and marks uncovered history truncated", async () => {
    const fetcher = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetcher);
    const data = await hyperliquid.history(
      { ...request, to: from + 60_000 * 5000 * (MAX_PAGES + 1) },
      "",
    );
    expect(fetcher).toHaveBeenCalledTimes(MAX_PAGES);
    expect(data.truncated).toBe(true);
  });

  it("refuses a dataset override", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(hyperliquid.history({ ...request, dataset: "x" }, "")).rejects.toThrow(
      "leave the dataset blank",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sanitizes upstream errors without relaying the body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("fixture-secret", { status: 403 })),
    );
    await expect(
      readPostJson("https://api.hyperliquid.xyz/info", { type: "perpDexs" }),
    ).rejects.toThrow("access denied");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fixture-secret");
      }),
    );
    await expect(
      readPostJson("https://api.hyperliquid.xyz/info", { type: "perpDexs" }),
    ).rejects.toThrow("timed out");
  });
});

describe("market CSV parser", () => {
  const header = "time,open,high,low,close,volume\n";
  it("normalizes timezone and epoch stamps, sorting without inventing bars", () => {
    const bars = parseMarketCsv(
      header + `1741012260,100,104,98,102,0\n2025-03-03T09:30:00-05:00,100,105,95,102,0`,
      "AAPL",
      "1m",
    );
    expect(bars).toHaveLength(2);
    expect(bars[0]!.time).toBe(from);
    expect(bars[1]!.time).toBe(from + 60_000);
  });
  it("accepts missing volume and quoted numeric fields", () => {
    expect(
      parseMarketCsv(
        'timestamp,open,high,low,close\n1741012200000,"100",105,95,102',
        "AAPL",
        "1m",
      )[0]!.volume,
    ).toBe(0);
  });
  it.each([
    ["2025-03-03 14:30:00,100,105,95,102,0", "timezone"],
    ["2025-02-30T14:30:00Z,100,105,95,102,0", "calendar date"],
    ["1741012200,100,90,95,102,0", "OHLC"],
    ["1741012200,100,105,95,102,-1", "negative volume"],
    ["1741012200,100,105,95,102,0\n1741012200,100,105,95,102,0", "Duplicate"],
    ["1741012200,100,105,95,102,0\n1741012261,100,105,95,102,0", "resolution"],
  ])("rejects invalid CSV data (%s)", (rows, message) =>
    expect(() => parseMarketCsv(header + rows, "AAPL", "1m")).toThrow(message),
  );
  it("rejects mixed symbols and trade statements", () => {
    expect(() =>
      parseMarketCsv("symbol," + header + "MSFT,1741012200,100,105,95,102,0", "AAPL", "1m"),
    ).toThrow("symbol");
    expect(() =>
      parseMarketCsv("symbol,side,quantity,price,time\nAAPL,buy,10,100,1741012200", "AAPL", "1m"),
    ).toThrow("open");
  });
});
