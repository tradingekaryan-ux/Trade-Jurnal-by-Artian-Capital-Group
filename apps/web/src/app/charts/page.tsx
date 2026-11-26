"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AccountPicker } from "@/components/account-picker";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { INSTRUMENTS, modeForCategory, type JournalMode, type ResultMode } from "@/lib/cfd";
import { HYPERLIQUID_TRADFI_SYMBOLS } from "@/lib/market-providers";
import { postJson } from "@/lib/use-api";
import type { OHLCV } from "@luxalgo/vela";

const TIMEFRAMES = ["1", "5", "15", "60", "1D"];
const toVelaTicker = (value: string) => value.replace(":", "-");
const toFeedSymbol = (ticker: string) =>
  HYPERLIQUID_TRADFI_SYMBOLS.find((item) => item.value === ticker)?.value ??
  HYPERLIQUID_TRADFI_SYMBOLS.find((item) => item.value === ticker.replace(/-/g, ":"))?.value ??
  ticker;

/** Vela data provider backed by the journal's Hyperliquid feed adapter. */
class TradFiProvider {
  info() {
    return {
      name: "hyperliquid",
      displayName: "Hyperliquid",
      capabilities: { enumerate: true, stream: false, symbolInfo: true },
      supportedTimeframes: TIMEFRAMES,
    };
  }

  async listSymbols() {
    return HYPERLIQUID_TRADFI_SYMBOLS.map((item) => ({
      ticker: toVelaTicker(item.value),
      description: `${item.label} (${item.group})`,
      type: item.group,
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
    const step = timeframe === "1D" ? 86_400_000 : (Number(timeframe) || 60) * 60_000;
    const from = range.from ?? to - (range.limit ?? 500) * step;
    const query = new URLSearchParams({
      symbol: toFeedSymbol(ticker),
      timeframe,
      from: String(from),
      to: String(to),
    });
    const response = await fetch(`/api/market-data/chart?${query}`);
    if (!response.ok) throw new Error("Gagal memuat candle Hyperliquid.");
    return ((await response.json()) as { bars: OHLCV[] }).bars;
  }
}

export default function ChartsPage() {
  const host = useRef<HTMLDivElement | null>(null);
  const [feedSymbol, setFeedSymbol] = useState("xyz:GOLD");
  const [timeframe, setTimeframe] = useState("60");
  const [target, setTarget] = useState<"cfd" | "crypto" | "stock" | "manual">("cfd");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lot, setLot] = useState("1");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [exit, setExit] = useState("");
  const [resultMode, setResultMode] = useState<ResultMode>("auto");
  const [manualPnl, setManualPnl] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const spec = useMemo(() => INSTRUMENTS.find((item) => item.symbol === feedSymbol), [feedSymbol]);
  const mode: JournalMode = spec ? modeForCategory(spec.category) : "cfd";
  const journalTarget: "cfd" | "crypto" | "stock" =
    spec?.category === "crypto-spot" || spec?.category === "crypto-perp"
      ? "crypto"
      : spec?.category === "stock"
        ? "stock"
        : "cfd";

  useEffect(() => {
    if (target !== "manual" && target !== journalTarget) setTarget(journalTarget);
  }, [journalTarget, target]);

  useEffect(() => {
    let workspace: { destroy?: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      if (!host.current || cancelled) return;
      const { VelaWorkspace } = await import("@luxalgo/vela/workspace");
      if (cancelled || !host.current) return;
      workspace = new VelaWorkspace(host.current, {
        layout: false,
        symbol: toVelaTicker(feedSymbol),
        timeframe,
        theme: "dark",
        live: false,
        persist: "trade-jurnal-vela",
        timeframes: TIMEFRAMES,
        timezone: "Etc/UTC",
        providers: { hyperliquid: () => new TradFiProvider() },
        drawingToolbar: true,
      });
    })();
    return () => {
      cancelled = true;
      workspace?.destroy?.();
    };
  }, [feedSymbol, timeframe]);

  const useLastPrice = async () => {
    setError("");
    const to = Date.now();
    const from = to - 3 * 86_400_000;
    const query = new URLSearchParams({
      symbol: feedSymbol,
      timeframe,
      from: String(from),
      to: String(to),
    });
    try {
      const response = await fetch(`/api/market-data/chart?${query}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal mengambil harga.");
      const bars = body.bars as OHLCV[];
      const last = bars.at(-1);
      if (!last) throw new Error("Tidak ada candle terbaru untuk instrumen ini.");
      setEntry(String(last.close));
      setMessage(`Harga terakhir ${feedSymbol}: ${last.close}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengambil harga.");
    }
  };

  const saveTrade = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const numeric = (value: string) => (value.trim() === "" ? undefined : Number(value));
      const now = new Date().toISOString();
      if (target === "cfd") {
        await postJson("/api/cfd-journal", {
          mode,
          symbol: feedSymbol,
          side,
          lot: numeric(lot),
          entry: numeric(entry),
          takeProfit: numeric(takeProfit),
          stopLoss: numeric(stopLoss),
          exit: numeric(exit),
          resultMode,
          manualPnl: numeric(manualPnl),
          leverage: mode === "crypto-perp" ? numeric(leverage) : undefined,
          openedAt: now,
        });
      } else {
        const fills = [
          {
            symbol: feedSymbol,
            side,
            quantity: Number(lot),
            price: Number(entry),
            fee: 0,
            executedAt: now,
          },
        ];
        if (exit && Number(exit) > 0)
          fills.push({
            symbol: feedSymbol,
            side: side === "buy" ? "sell" : "buy",
            quantity: Number(lot),
            price: Number(exit),
            fee: 0,
            executedAt: now,
          });
        await postJson("/api/executions", { accountId, executions: fills });
      }
      setMessage("Trade berhasil masuk ke jurnal.");
      setExit("");
      setManualPnl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan trade.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title="Chart" />
      <div className="mx-auto max-w-[1500px] space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="chart-symbol">Instrument (Hyperliquid)</Label>
            <OptionSelect id="chart-symbol" value={feedSymbol} onValueChange={setFeedSymbol}>
              {HYPERLIQUID_TRADFI_SYMBOLS.map((item) => (
                <option key={item.value} value={item.value}>
                  [{item.group}] {item.label} · {item.value}
                </option>
              ))}
            </OptionSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="chart-timeframe">Timeframe</Label>
            <OptionSelect id="chart-timeframe" value={timeframe} onValueChange={setTimeframe}>
              {TIMEFRAMES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </OptionSelect>
          </div>
        </div>

        <div
          ref={host}
          className="h-[620px] w-full overflow-hidden rounded-lg border bg-card"
          aria-label="Hyperliquid Trading Chart"
        />

        <Card>
          <CardHeader>
            <CardTitle>Input trade ke jurnal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Simbol dan harga bisa diambil dari chart di atas. Pilih jurnal tujuan lalu simpan.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="journal-target">Jurnal tujuan</Label>
                <OptionSelect
                  id="journal-target"
                  value={target}
                  onValueChange={(value) =>
                    setTarget(value as "cfd" | "crypto" | "stock" | "manual")
                  }
                >
                  <option value="cfd" disabled={journalTarget !== "cfd"}>
                    CFD journal
                  </option>
                  <option value="crypto" disabled={journalTarget !== "crypto"}>
                    Crypto journal
                  </option>
                  <option value="stock" disabled={journalTarget !== "stock"}>
                    US Stock journal
                  </option>
                  <option value="futures" disabled>
                    Futures journal (coming soon)
                  </option>
                  <option value="manual">Manual (akun execution)</option>
                </OptionSelect>
              </div>
              {target === "manual" && (
                <div className="space-y-1">
                  <Label>Akun</Label>
                  <AccountPicker value={accountId} onChange={setAccountId} kind="manual" />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="journal-side">Side</Label>
                <OptionSelect
                  id="journal-side"
                  value={side}
                  onValueChange={(value) => setSide(value as "buy" | "sell")}
                >
                  <option value="buy">Buy / Long</option>
                  <option value="sell">Sell / Short</option>
                </OptionSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="journal-lot">
                  {mode === "cfd"
                    ? "Lot"
                    : mode === "stock"
                      ? "Size (lembar saham)"
                      : "Size (unit koin)"}
                </Label>
                <Input
                  id="journal-lot"
                  inputMode="decimal"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="journal-entry">Entry</Label>
                <Input
                  id="journal-entry"
                  inputMode="decimal"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="journal-sl">Stop loss</Label>
                <Input
                  id="journal-sl"
                  inputMode="decimal"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="journal-tp">Take profit</Label>
                <Input
                  id="journal-tp"
                  inputMode="decimal"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="journal-exit">Exit / hasil (kosong = running)</Label>
                <Input
                  id="journal-exit"
                  inputMode="decimal"
                  value={exit}
                  onChange={(e) => setExit(e.target.value)}
                />
              </div>
              {target === "cfd" && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="journal-result">Sumber hasil</Label>
                    <OptionSelect
                      id="journal-result"
                      value={resultMode}
                      onValueChange={(value) => setResultMode(value as ResultMode)}
                    >
                      <option value="auto">Otomatis dari exit</option>
                      <option value="manual">Manual (USD)</option>
                      <option value="breakeven">Breakeven</option>
                    </OptionSelect>
                  </div>
                  {resultMode === "manual" && (
                    <div className="space-y-1">
                      <Label htmlFor="journal-pnl">Hasil manual (USD)</Label>
                      <Input
                        id="journal-pnl"
                        inputMode="decimal"
                        value={manualPnl}
                        onChange={(e) => setManualPnl(e.target.value)}
                      />
                    </div>
                  )}
                  {mode === "crypto-perp" && (
                    <div className="space-y-1">
                      <Label htmlFor="journal-lev">Leverage</Label>
                      <Input
                        id="journal-lev"
                        inputMode="decimal"
                        value={leverage}
                        onChange={(e) => setLeverage(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            {(error || message) && (
              <p className={`text-sm ${error ? "text-destructive" : "text-profit"}`}>
                {error || message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={useLastPrice}>
                Ambil harga terakhir
              </Button>
              <Button
                onClick={saveTrade}
                disabled={busy || !entry || !lot || (target === "manual" && !accountId)}
              >
                {busy ? "Menyimpan…" : "Simpan ke jurnal"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
