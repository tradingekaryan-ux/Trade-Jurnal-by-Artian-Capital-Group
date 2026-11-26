"use client";

import { useEffect, useRef } from "react";
import { FilterBar } from "@/components/filter-bar";
import { INSTRUMENTS } from "@/lib/cfd";
import type { OHLCV } from "@luxalgo/vela";

/** Vela data provider backed by the journal's Hyperliquid tradfi adapter. */
class TradFiProvider {
  info() {
    return {
      name: "hyperliquid",
      displayName: "Hyperliquid TradFi",
      capabilities: { enumerate: true, stream: false, symbolInfo: true },
      supportedTimeframes: ["1", "5", "15", "60", "1D"],
    };
  }

  async listSymbols() {
    return INSTRUMENTS.map((item) => ({
      ticker: item.symbol.replace("xyz:", ""),
      description: `${item.label} (${item.category})`,
      type: item.category,
    }));
  }

  async getSymbolInfo(ticker: string) {
    return { ticker };
  }

  async getBars(
    ticker: string,
    timeframe: string,
    range: { from?: number; to?: number; limit?: number },
  ) {
    const to = range.to ?? Date.now();
    const span = (range.limit ?? 500) * 60_000 * Math.max(1, Number(timeframe) || 60);
    const from = range.from ?? to - span;
    const query = new URLSearchParams({
      symbol: ticker,
      timeframe,
      from: String(from),
      to: String(to),
    });
    const response = await fetch(`/api/market-data/chart?${query}`);
    if (!response.ok) throw new Error("Gagal memuat candle Hyperliquid.");
    const body = (await response.json()) as { bars: OHLCV[] };
    return body.bars;
  }
}

export default function ChartsPage() {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let workspace: { destroy?: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      if (!host.current || cancelled) return;
      const { VelaWorkspace } = await import("@luxalgo/vela/workspace");
      if (cancelled || !host.current) return;
      workspace = new VelaWorkspace(host.current, {
        layout: false,
        symbol: "GOLD",
        timeframe: "60",
        theme: "dark",
        live: false,
        persist: "trade-jurnal-vela",
        timeframes: ["1", "5", "15", "60", "1D"],
        timezone: "Etc/UTC",
        providers: { hyperliquid: () => new TradFiProvider() },
        drawingToolbar: true,
      });
    })();
    return () => {
      cancelled = true;
      workspace?.destroy?.();
    };
  }, []);

  return (
    <div>
      <FilterBar title="Chart" />
      <div className="mx-auto max-w-[1500px] space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          Chart Vela dengan data candle Hyperliquid untuk instrumen FOREX, COMMODITY, dan INDICE.
          Gunakan toolbar untuk timeframe, indikator, drawing tools, dan replay visual.
        </p>
        <div
          ref={host}
          className="h-[680px] w-full overflow-hidden rounded-lg border bg-card"
          aria-label="Hyperliquid Trading Chart"
        />
      </div>
    </div>
  );
}
