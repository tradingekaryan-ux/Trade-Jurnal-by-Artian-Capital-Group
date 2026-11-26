"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { AccountPicker } from "@/components/account-picker";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { INSTRUMENTS, modeForCategory, type JournalMode, type ResultMode } from "@/lib/cfd";
import { HYPERLIQUID_TRADFI_SYMBOLS, type TradFiGroup } from "@/lib/market-providers";
import { postJson } from "@/lib/use-api";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const GROUPS = ["Forex", "Komoditas", "Indeks", "US Stock", "Crypto Perp", "Crypto Spot"] as const;

interface Candle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

export default function ChartsPage() {
  const container = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number] | "all">("all");
  const [symbol, setSymbol] = useState("xyz:GOLD");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [realtime, setRealtime] = useState(false);

  const [target, setTarget] = useState<"cfd" | "crypto" | "stock" | "manual">("cfd");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("1");
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

  const spec = useMemo(() => INSTRUMENTS.find((item) => item.symbol === symbol), [symbol]);
  const mode: JournalMode = spec ? modeForCategory(spec.category) : "cfd";
  const journalTarget: "cfd" | "crypto" | "stock" =
    spec?.category === "crypto-spot" || spec?.category === "crypto-perp"
      ? "crypto"
      : spec?.category === "stock"
        ? "stock"
        : "cfd";
  const instruments = useMemo(
    () =>
      HYPERLIQUID_TRADFI_SYMBOLS.filter(
        (item) => group === "all" || item.group === (group as TradFiGroup),
      ),
    [group],
  );

  useEffect(() => {
    if (target !== "manual" && target !== journalTarget) setTarget(journalTarget);
  }, [journalTarget, target]);

  // Create the chart once.
  useEffect(() => {
    if (!container.current || chartRef.current) return;
    const chart = createChart(container.current, {
      layout: { background: { type: ColorType.Solid, color: "#0b0e11" }, textColor: "#d1d5db" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      rightPriceScale: { borderColor: "#374151" },
      timeScale: { borderColor: "#374151", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      autoSize: true,
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  // Load history and stream live candles from Hyperliquid.
  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const applyCandle = (candle: Candle) => {
      if (cancelled || !candleRef.current || !volumeRef.current) return;
      const time = Math.floor(candle.t / 1000) as UTCTimestamp;
      candleRef.current.update({
        time,
        open: Number(candle.o),
        high: Number(candle.h),
        low: Number(candle.l),
        close: Number(candle.c),
      });
      volumeRef.current.update({
        time,
        value: Number(candle.v),
        color: Number(candle.c) >= Number(candle.o) ? "rgba(22,163,74,0.5)" : "rgba(220,38,38,0.5)",
      });
      setLastPrice(Number(candle.c));
    };

    const load = async () => {
      if (!candleRef.current) return;
      const to = Date.now();
      const from = to - 90 * 86_400_000;
      const query = new URLSearchParams({ symbol, timeframe, from: String(from), to: String(to) });
      try {
        const response = await fetch(`/api/market-data/chart?${query}`);
        const body = await response.json();
        if (!response.ok || cancelled) throw new Error(body.error ?? "Gagal memuat candle.");
        const bars = body.bars as {
          time: number;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
        }[];
        candleRef.current.setData(
          bars.map((bar) => ({
            time: Math.floor(bar.time / 1000) as UTCTimestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          })),
        );
        volumeRef.current?.setData(
          bars.map((bar) => ({
            time: Math.floor(bar.time / 1000) as UTCTimestamp,
            value: bar.volume,
            color: bar.close >= bar.open ? "rgba(22,163,74,0.5)" : "rgba(220,38,38,0.5)",
          })),
        );
        chartRef.current?.timeScale().fitContent();
        const last = bars.at(-1);
        if (last) setLastPrice(last.close);
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Gagal memuat chart.");
      }
    };

    const startPolling = () => {
      if (poll) return;
      setRealtime(false);
      poll = setInterval(() => {
        void fetch(
          `/api/market-data/chart?${new URLSearchParams({ symbol, timeframe, from: String(Date.now() - 3 * 86_400_000), to: String(Date.now()) })}`,
        )
          .then((response) => response.json())
          .then((body: { bars?: Candle[] }) => body.bars?.at(-1) && applyCandle(body.bars.at(-1)!))
          .catch(() => {});
      }, 15_000);
    };

    void load().then(() => {
      if (cancelled) return;
      try {
        socket = new WebSocket("wss://api.hyperliquid.xyz/ws");
        socket.onopen = () => {
          socket?.send(
            JSON.stringify({
              method: "subscribe",
              subscription: { type: "candle", coin: symbol, interval: timeframe },
            }),
          );
        };
        socket.onmessage = (event) => {
          const msg = JSON.parse(String(event.data)) as { channel?: string; data?: Candle[] };
          if (msg.channel === "candle" && msg.data?.length) {
            setRealtime(true);
            applyCandle(msg.data[0]!);
          }
        };
        socket.onerror = startPolling;
        socket.onclose = startPolling;
      } catch {
        startPolling();
      }
    });

    return () => {
      cancelled = true;
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(
          JSON.stringify({
            method: "unsubscribe",
            subscription: { type: "candle", coin: symbol, interval: timeframe },
          }),
        );
      socket?.close();
      if (poll) clearInterval(poll);
    };
  }, [symbol, timeframe]);

  const useChartPrice = () => {
    if (lastPrice === null) {
      setError("Harga chart belum tersedia.");
      return;
    }
    setEntry(String(lastPrice));
    setMessage(`Entry diisi dari harga chart: ${lastPrice}`);
    setError("");
  };

  const saveTrade = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const numeric = (value: string) => (value.trim() === "" ? undefined : Number(value));
      const now = new Date().toISOString();
      if (target === "manual") {
        const fills = [
          { symbol, side, quantity: Number(size), price: Number(entry), fee: 0, executedAt: now },
        ];
        if (exit && Number(exit) > 0)
          fills.push({
            symbol,
            side: side === "buy" ? "sell" : "buy",
            quantity: Number(size),
            price: Number(exit),
            fee: 0,
            executedAt: now,
          });
        await postJson("/api/executions", { accountId, executions: fills });
      } else {
        await postJson("/api/cfd-journal", {
          mode,
          symbol,
          side,
          size: numeric(size),
          entry: numeric(entry),
          takeProfit: numeric(takeProfit),
          stopLoss: numeric(stopLoss),
          exit: numeric(exit),
          resultMode,
          manualPnl: numeric(manualPnl),
          leverage: mode === "crypto-perp" ? numeric(leverage) : undefined,
          openedAt: now,
        });
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
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-4">
            <div className="space-y-1">
              <Label htmlFor="chart-group">Kategori pair</Label>
              <OptionSelect
                id="chart-group"
                value={group}
                onValueChange={(value) => setGroup(value as typeof group)}
              >
                <option value="all">Semua</option>
                {GROUPS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </OptionSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="chart-symbol">Pair (Hyperliquid)</Label>
              <OptionSelect id="chart-symbol" value={symbol} onValueChange={setSymbol}>
                {instruments.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} · {item.value}
                  </option>
                ))}
              </OptionSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="chart-timeframe">Timeframe</Label>
              <OptionSelect
                id="chart-timeframe"
                value={timeframe}
                onValueChange={(value) => setTimeframe(value as Timeframe)}
              >
                {TIMEFRAMES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </OptionSelect>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {realtime ? "● Live WebSocket Hyperliquid" : "○ Mode polling 15s"}
              {lastPrice !== null && ` · ${symbol}: ${lastPrice}`}
            </div>
          </CardContent>
        </Card>

        <div
          className="h-[600px] w-full overflow-hidden rounded-lg border bg-[#0b0e11]"
          ref={container}
        />

        <Card>
          <CardHeader>
            <CardTitle>Input trade ke jurnal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Instrument dan timeframe mengikuti chart di atas ({symbol} · {timeframe}). Pilih
              jurnal tujuan, lalu isi parameter trade.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="journal-target">Jurnal tujuan</Label>
                <OptionSelect
                  id="journal-target"
                  value={target}
                  onValueChange={(value) => setTarget(value as typeof target)}
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
                    Futures (coming soon)
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
                <Label htmlFor="journal-size">
                  {mode === "cfd"
                    ? "Lot"
                    : mode === "stock"
                      ? "Size (lembar saham)"
                      : "Size (unit koin)"}
                </Label>
                <Input
                  id="journal-size"
                  inputMode="decimal"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
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
                <Label htmlFor="journal-exit">Exit (kosong = running)</Label>
                <Input
                  id="journal-exit"
                  inputMode="decimal"
                  value={exit}
                  onChange={(e) => setExit(e.target.value)}
                />
              </div>
              {target !== "manual" && (
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
              <Button variant="outline" onClick={useChartPrice}>
                Pakai harga chart
              </Button>
              <Button
                onClick={saveTrade}
                disabled={busy || !entry || !size || (target === "manual" && !accountId)}
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
