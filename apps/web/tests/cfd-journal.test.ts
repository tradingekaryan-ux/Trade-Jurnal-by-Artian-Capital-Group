import { describe, expect, it } from "vitest";
import { calculateJournal, type JournalInput } from "../src/lib/cfd";

const base: JournalInput = {
  mode: "cfd",
  side: "buy",
  symbol: "EURUSD",
  lot: 1,
  entry: 1.1,
  resultMode: "auto",
};

describe("CFD journal calculations", () => {
  it("calculates pips and USD profit for a long CFD trade", () => {
    const result = calculateJournal({ ...base, exit: 1.105, usdPerPip: 10 });
    expect(result.status).toBe("closed");
    expect(result.pips).toBe(50);
    expect(result.pnl).toBe(500);
  });

  it("uses the short direction and overrides USD per pip", () => {
    const result = calculateJournal({
      ...base,
      side: "sell",
      exit: 1.095,
      lot: 2,
      usdPerPip: 12,
    });
    expect(result.pips).toBe(50);
    expect(result.pnl).toBe(1200);
  });

  it("keeps a trade running when neither exit nor result is provided", () => {
    const result = calculateJournal(base);
    expect(result.status).toBe("running");
    expect(result.pnl).toBeNull();
    expect(result.exitPrice).toBeNull();
  });

  it("treats a manual result as closed and derives pips for display", () => {
    const result = calculateJournal({
      ...base,
      resultMode: "manual",
      manualPnl: 250,
      stopLoss: 1.095,
      takeProfit: 1.11,
    });
    expect(result.status).toBe("closed");
    expect(result.pnl).toBe(250);
    expect(result.pips).toBe(25);
    expect(result.exitPrice).toBeCloseTo(1.1025, 4);
    expect(result.riskReward).toBeCloseTo(2, 6);
    expect(result.rMultiple).toBeCloseTo(0.5, 6);
  });

  it("treats breakeven as a closed trade with zero profit", () => {
    const result = calculateJournal({ ...base, resultMode: "breakeven" });
    expect(result.status).toBe("closed");
    expect(result.pnl).toBe(0);
  });

  it("calculates futures tick P&L", () => {
    const result = calculateJournal({
      ...base,
      mode: "futures",
      symbol: "ES",
      entry: 7000,
      exit: 7001,
    });
    expect(result.pips).toBe(4);
    expect(result.pnl).toBe(50);
  });

  it("calculates percentage modes with leverage for crypto perpetuals", () => {
    const spot = calculateJournal({
      ...base,
      mode: "crypto-spot",
      symbol: "BTCUSD",
      entry: 100,
      exit: 110,
      lot: 10,
    });
    expect(spot.pnl).toBe(100);

    const perp = calculateJournal({
      ...base,
      mode: "crypto-perp",
      symbol: "BTCUSD",
      entry: 100,
      exit: 110,
      lot: 10,
      leverage: 5,
    });
    expect(perp.pnl).toBe(500);
  });
});
