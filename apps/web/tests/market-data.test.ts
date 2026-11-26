import { createMarketTransport, marketTransport } from "../src/server/market-data/transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateExcursions } from "../src/lib/excursions";
import { replayFrame } from "../src/lib/trade-replay";
import { hyperliquid } from "../src/server/market-data/hyperliquid";
import { MAX_PAGES } from "../src/server/market-data/http";
import type { MarketHistory } from "../src/lib/market-data";

const start = Date.parse("2026-01-02T10:00:00Z");
const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();
const fill = (minute: number, side: "buy" | "sell", quantity: number, price: number) => ({
  executedAt: at(minute),
  side,
  quantity,
  price,
});
const candle = (minute: number, low = 98, high = 104) => ({
  time: start + minute * 60_000,
  open: 100,
  high,
  low,
  close: 100,
  volume: 1,
});
const history = (bars = [candle(0), candle(1), candle(2)]): MarketHistory => ({
  provider: "Test",
  symbol: "TEST",
  resolution: "1m",
  fetchedAt: at(4),
  truncated: false,
  warnings: [],
  bars,
});
const trade = { direction: "long", openedAt: at(0), closedAt: at(3), assetClass: "equity" };

afterEach(() => vi.unstubAllGlobals());

describe("gross position excursion estimates", () => {
  it("withholds misleading estimates when live market prices disagree with demo fills", () => {
    const fills = [fill(0, "buy", 10, 222), fill(3, "sell", 10, 221)];
    const data = history(
      [0, 1, 2].map((minute) => ({ ...candle(minute, 324, 326), open: 325, close: 325 })),
    );
    for (const confirmed of [true, false])
      expect(estimateExcursions(trade, fills, data, confirmed)).toMatchObject({
        mae: null,
        mfe: null,
        priceBasisMismatch: true,
      });
  });

  it("calculates long and short excursions with adverse values shown as positive magnitudes", () => {
    expect(
      estimateExcursions(
        trade,
        [fill(0, "buy", 10, 100), fill(3, "sell", 10, 102)],
        history(),
        true,
      ),
    ).toMatchObject({ mae: 20, mfe: 40, sampledBars: 3 });
    expect(
      estimateExcursions(
        { ...trade, direction: "short" },
        [fill(0, "sell", 10, 100), fill(3, "buy", 10, 102)],
        history(),
        true,
      ),
    ).toMatchObject({ mae: 40, mfe: 20 });
  });
  it("uses actual remaining exposure after partial exits, retaining realized P&L", () => {
    const fills = [fill(0, "buy", 10, 100), fill(1, "sell", 8, 102), fill(3, "sell", 2, 103)];
    expect(
      estimateExcursions(
        trade,
        fills,
        history([candle(0, 100, 102), candle(1, 90, 120), candle(2, 100, 103)]),
        true,
      ),
    ).toMatchObject({ mae: 4, mfe: 56 });
  });
  it("uses cash flows from scale-ins without applying the eventual size to earlier prices", () => {
    const fills = [fill(0, "buy", 2, 100), fill(1, "buy", 8, 110), fill(3, "sell", 10, 111)];
    expect(
      estimateExcursions(
        trade,
        fills,
        history([
          candle(0, 90, 110),
          { ...candle(1, 108, 115), open: 110, close: 110 },
          { ...candle(2, 108, 112), open: 110, close: 110 },
        ]),
        true,
      ),
    ).toMatchObject({ mae: 20, mfe: 70 });
  });
  it("excludes highs and lows from bars crossing an execution or trade boundary", () => {
    const fills = [fill(0.5, "buy", 10, 100), fill(1.5, "sell", 5, 100), fill(3, "sell", 5, 100)];
    expect(
      estimateExcursions(
        { ...trade, openedAt: at(0.5) },
        fills,
        history([candle(0, 1, 999), candle(1, 1, 999), candle(2, 99, 102)]),
        true,
      ),
    ).toMatchObject({ mae: 5, mfe: 10, sampledBars: 1, excludedBars: 2 });
  });
  it("withholds numbers for absent, truncated, unconfirmed, or uncovered data", () => {
    const fills = [fill(0, "buy", 10, 100), fill(3, "sell", 10, 102)];
    for (const data of [
      history([]),
      history([candle(1), candle(2)]),
      history([candle(0)]),
      { ...history(), truncated: true },
    ])
      expect(estimateExcursions(trade, fills, data, true).mae).toBeNull();
    expect(estimateExcursions(trade, fills, history(), false).mfe).toBeNull();
    expect(estimateExcursions({ ...trade, closedAt: null }, fills, history(), true).mfe).toBeNull();
  });
  it("requires derivative multipliers and applies configured multipliers", () => {
    const fills = [fill(0, "buy", 1, 100), fill(3, "sell", 1, 102)];
    expect(
      estimateExcursions({ ...trade, assetClass: "futures" }, fills, history(), true).mae,
    ).toBeNull();
    expect(
      estimateExcursions(
        { ...trade, assetClass: "futures", contractMultiplier: 50 },
        fills,
        history(),
        true,
      ),
    ).toMatchObject({ mae: 100, mfe: 200 });
  });
  it("does not treat a reversal spanning two trade cycles as one closed position", () => {
    expect(
      estimateExcursions(
        trade,
        [fill(0, "buy", 10, 100), fill(3, "sell", 15, 102)],
        history(),
        true,
      ).mae,
    ).toBeNull();
  });
  it("reports internal gaps and refuses fill-only estimates", () => {
    const fills = [fill(0, "buy", 10, 100), fill(3, "sell", 10, 102)];
    expect(
      estimateExcursions(trade, fills, history([candle(0), candle(2)]), true).warnings.join(" "),
    ).toContain("gaps");
    expect(
      estimateExcursions(
        { ...trade, openedAt: at(0.2), closedAt: at(0.8) },
        [fill(0.2, "buy", 1, 100), fill(0.8, "sell", 1, 101)],
        history([candle(0)]),
        true,
      ).mae,
    ).toBeNull();
  });
});

describe("Hyperliquid REST contract", () => {
  const hlCandle = (minute: number, close = "102") => ({
    t: start + minute * 60_000,
    T: start + minute * 60_000 + 59_999,
    s: "xyz:SP500",
    i: "1m",
    o: "100",
    h: "104",
    l: "98",
    c: close,
    v: "1",
    n: 5,
  });
  const fetchCandles = (rows: unknown[]) =>
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        type: string;
        req: { coin: string; interval: string; startTime: number; endTime: number };
      };
      expect(body.type).toBe("candleSnapshot");
      expect(body.req.coin).toBe("xyz:SP500");
      return Response.json(rows);
    });
  const historyRequest = (from: number, to: number) => ({
    symbol: "xyz:SP500",
    resolution: "1m" as const,
    from,
    to,
  });

  it("normalizes string prices, ordering and duplicate bars, filtering to the trade", async () => {
    vi.stubGlobal("fetch", fetchCandles([hlCandle(1), hlCandle(0), hlCandle(0), hlCandle(3)]));
    const result = await hyperliquid.history(historyRequest(start + 10_000, start + 180_000), "");
    expect(result.bars.map((bar) => bar.time)).toEqual([start, start + 60_000]);
    expect(result.bars[0]).toMatchObject({ open: 100, high: 104, low: 98, close: 102, volume: 1 });
    expect(result.truncated).toBe(false);
  });

  it("rejects malformed and conflicting candles", async () => {
    vi.stubGlobal("fetch", fetchCandles([{ ...hlCandle(0), o: null }]));
    await expect(hyperliquid.history(historyRequest(start, start + 60_000), "")).rejects.toThrow();
    marketTransport.clear();
    vi.stubGlobal("fetch", fetchCandles([hlCandle(0), { ...hlCandle(0), c: "103" }]));
    await expect(hyperliquid.history(historyRequest(start, start + 60_000), "")).rejects.toThrow(
      "Conflicting candles",
    );
  });

  it("reuses one validated page across overlapping trades", async () => {
    const fetcher = fetchCandles([hlCandle(0), hlCandle(1), hlCandle(2)]);
    vi.stubGlobal("fetch", fetcher);
    const histories = await Promise.all(
      Array.from({ length: 12 }, () =>
        hyperliquid.history(historyRequest(start, start + 180_000), ""),
      ),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(histories.every((item) => item.bars.length === 3 && !item.truncated)).toBe(true);
  });

  it("marks capped history as truncated", async () => {
    vi.stubGlobal("fetch", fetchCandles([]));
    const result = await hyperliquid.history(
      historyRequest(start, start + 60_000 * 5000 * (MAX_PAGES + 1)),
      "",
    );
    expect(result.truncated).toBe(true);
  });

  it("sanitizes denied access and transport errors", async () => {
    for (const status of [401, 403, 429, 500]) {
      marketTransport.clear();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("upstream-secret", { status })),
      );
      await expect(hyperliquid.test("")).rejects.not.toThrow("upstream-secret");
    }
    marketTransport.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("upstream-secret");
      }),
    );
    await expect(hyperliquid.test("")).rejects.toThrow("failed or timed out");
  });
});
describe("replay without future chart data", () => {
  it("reveals only completed candles and executions through the cursor, and rewinds", () => {
    const fills = [fill(0.5, "buy", 10, 100), fill(2.5, "sell", 10, 102)];
    const first = replayFrame(history(), fills, 1);
    expect(first.bars).toHaveLength(1);
    expect(first.fills).toEqual([fills[0]]);
    expect(replayFrame(history(), fills, 3).fills).toHaveLength(2);
    expect(replayFrame(history(), fills, 1).fills).toHaveLength(1);
    expect(replayFrame(history(), fills, 0).fills).toHaveLength(0);
  });
});

afterEach(() => marketTransport.clear());

beforeEach(() => Object.assign(marketTransport, createMarketTransport({ minIntervalMs: 0 })));
