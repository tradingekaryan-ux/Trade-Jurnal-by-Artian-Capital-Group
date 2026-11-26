"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import {
  INSTRUMENTS,
  MODE_LABELS,
  calculateJournal,
  instrumentFor,
  isJournalMode,
  type JournalMode,
  type ResultMode,
} from "@/lib/cfd";
import { postJson } from "@/lib/use-api";
import { fmtNumber } from "@/lib/utils";

interface CfdTrade {
  id: string;
  category: string;
  symbol: string;
  mode: JournalMode;
  side: "buy" | "sell";
  lot: number;
  entry: number;
  takeProfit: number | null;
  stopLoss: number | null;
  exitPrice: number | null;
  resultMode: ResultMode;
  manualPnl: number | null;
  usdPerPip: number | null;
  leverage: number | null;
  pips: number | null;
  pnl: number | null;
  riskReward: number | null;
  rMultiple: number | null;
  status: "running" | "closed";
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
}

type FormState = {
  mode: JournalMode;
  symbol: string;
  side: "buy" | "sell";
  lot: string;
  entry: string;
  takeProfit: string;
  stopLoss: string;
  exit: string;
  resultMode: ResultMode;
  manualPnl: string;
  leverage: string;
  usdPerPip: string;
  openedAt: string;
  notes: string;
};

const nowLocal = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const initialForm = (): FormState => ({
  mode: "cfd",
  symbol: "xyz:EUR",
  side: "buy",
  lot: "1",
  entry: "",
  takeProfit: "",
  stopLoss: "",
  exit: "",
  resultMode: "auto",
  manualPnl: "",
  leverage: "1",
  usdPerPip: "",
  openedAt: nowLocal(),
  notes: "",
});

const num = (value: string): number | undefined =>
  value.trim() === "" ? undefined : Number(value);

export default function CfdJournalPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [trades, setTrades] = useState<CfdTrade[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    fetch("/api/cfd-journal")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { trades: CfdTrade[] }) => setTrades(body.trades))
      .catch(() => setError("Gagal memuat jurnal."));
  };
  useEffect(load, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
  };

  const spec = instrumentFor(form.symbol);
  const preview = useMemo(
    () =>
      calculateJournal({
        mode: form.mode,
        side: form.side,
        symbol: form.symbol,
        lot: num(form.lot) ?? 0,
        entry: num(form.entry) ?? 0,
        exit: num(form.exit),
        takeProfit: num(form.takeProfit),
        stopLoss: num(form.stopLoss),
        resultMode: form.resultMode,
        manualPnl: num(form.manualPnl),
        leverage: num(form.leverage),
        usdPerPip: num(form.usdPerPip),
      }),
    [form],
  );

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/cfd-journal", {
        ...form,
        lot: num(form.lot),
        entry: num(form.entry),
        takeProfit: num(form.takeProfit),
        stopLoss: num(form.stopLoss),
        exit: num(form.exit),
        manualPnl: num(form.manualPnl),
        leverage: num(form.leverage),
        usdPerPip: num(form.usdPerPip),
        openedAt: form.openedAt ? new Date(form.openedAt).toISOString() : new Date().toISOString(),
      });
      setMessage(
        preview.status === "closed" ? "Trade closed tersimpan." : "Running trade tersimpan.",
      );
      setForm((current) => ({ ...initialForm(), mode: current.mode, symbol: current.symbol }));
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan trade.");
    } finally {
      setBusy(false);
    }
  };

  const closeTrade = async (trade: CfdTrade, result: number) => {
    try {
      await postJson(
        "/api/cfd-journal",
        {
          id: trade.id,
          exit: trade.exitPrice ?? trade.entry,
          resultMode: "manual",
          manualPnl: result,
        },
        "PATCH",
      );
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menutup trade.");
    }
  };

  const stats = useMemo(() => {
    const closed = trades.filter((trade) => trade.status === "closed");
    const wins = closed.filter((trade) => (trade.pnl ?? 0) > 0);
    const losses = closed.filter((trade) => (trade.pnl ?? 0) < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0));
    const totalPnl = closed.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
    return {
      total: trades.length,
      running: trades.filter((trade) => trade.status === "running").length,
      closed: closed.length,
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      totalPnl,
      totalPips: closed.reduce((sum, trade) => sum + (trade.pips ?? 0), 0),
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      expectancy: closed.length ? totalPnl / closed.length : 0,
      avgR:
        closed.filter((trade) => trade.rMultiple !== null).length > 0
          ? closed.reduce((sum, trade) => sum + (trade.rMultiple ?? 0), 0) /
            closed.filter((trade) => trade.rMultiple !== null).length
          : 0,
    };
  }, [trades]);

  return (
    <div>
      <FilterBar title="CFD journal" />
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Jurnal trading CFD-first: lot, pips/point, dan harga dari feed Hyperliquid. Pilih mode
          instrumen untuk kalkulasi otomatis; isi hasil manual bila ditutup manual atau breakeven.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4 text-xs">
              Total trade<div className="text-lg font-semibold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs">
              Win rate<div className="text-lg font-semibold">{fmtNumber(stats.winRate, 1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs">
              Total P&L<div className="text-lg font-semibold">${fmtNumber(stats.totalPnl, 2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs">
              Total pips / poin
              <div className="text-lg font-semibold">{fmtNumber(stats.totalPips, 1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs">
              Profit factor
              <div className="text-lg font-semibold">
                {Number.isFinite(stats.profitFactor) ? fmtNumber(stats.profitFactor, 2) : "∞"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs">
              Expectancy
              <div className="text-lg font-semibold">${fmtNumber(stats.expectancy, 2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs">
              Rata-rata R<div className="text-lg font-semibold">{fmtNumber(stats.avgR, 2)}R</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs">
              Running / Closed
              <div className="text-lg font-semibold">
                {stats.running} / {stats.closed}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tambah trade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="cfd-mode">Mode jurnal</Label>
                <OptionSelect
                  id="cfd-mode"
                  value={form.mode}
                  onValueChange={(value) => isJournalMode(value) && set("mode", value)}
                >
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </OptionSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-symbol">Instrument</Label>
                <OptionSelect
                  id="cfd-symbol"
                  value={form.symbol}
                  onValueChange={(value) => set("symbol", value)}
                >
                  {INSTRUMENTS.map((item) => (
                    <option key={item.symbol} value={item.symbol}>
                      [{item.category.toUpperCase()}] {item.label} · {item.symbol}
                    </option>
                  ))}
                </OptionSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-side">Side</Label>
                <OptionSelect
                  id="cfd-side"
                  value={form.side}
                  onValueChange={(value) => set("side", value as "buy" | "sell")}
                >
                  <option value="buy">Buy / Long</option>
                  <option value="sell">Sell / Short</option>
                </OptionSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-lot">Lot / ukuran</Label>
                <Input
                  id="cfd-lot"
                  inputMode="decimal"
                  value={form.lot}
                  onChange={(event) => set("lot", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-entry">Entry</Label>
                <Input
                  id="cfd-entry"
                  inputMode="decimal"
                  value={form.entry}
                  onChange={(event) => set("entry", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-opened">Waktu buka</Label>
                <Input
                  id="cfd-opened"
                  type="datetime-local"
                  value={form.openedAt}
                  onChange={(event) => set("openedAt", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-sl">Stop loss</Label>
                <Input
                  id="cfd-sl"
                  inputMode="decimal"
                  value={form.stopLoss}
                  onChange={(event) => set("stopLoss", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-tp">Take profit</Label>
                <Input
                  id="cfd-tp"
                  inputMode="decimal"
                  value={form.takeProfit}
                  onChange={(event) => set("takeProfit", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-exit">Exit / hasil harga (kosongkan untuk running)</Label>
                <Input
                  id="cfd-exit"
                  inputMode="decimal"
                  value={form.exit}
                  onChange={(event) => set("exit", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfd-result">Sumber hasil</Label>
                <OptionSelect
                  id="cfd-result"
                  value={form.resultMode}
                  onValueChange={(value) => set("resultMode", value as ResultMode)}
                >
                  <option value="auto">Otomatis dari exit</option>
                  <option value="manual">Input manual (USD)</option>
                  <option value="breakeven">Breakeven</option>
                </OptionSelect>
              </div>
              {form.resultMode === "manual" && (
                <div className="space-y-1">
                  <Label htmlFor="cfd-pnl">Hasil manual (USD)</Label>
                  <Input
                    id="cfd-pnl"
                    inputMode="decimal"
                    value={form.manualPnl}
                    onChange={(event) => set("manualPnl", event.target.value)}
                  />
                </div>
              )}
              {form.mode === "crypto-perp" && (
                <div className="space-y-1">
                  <Label htmlFor="cfd-lev">Leverage</Label>
                  <Input
                    id="cfd-lev"
                    inputMode="decimal"
                    value={form.leverage}
                    onChange={(event) => set("leverage", event.target.value)}
                  />
                </div>
              )}
              {(form.mode === "cfd" || form.mode === "futures") && (
                <div className="space-y-1">
                  <Label htmlFor="cfd-usdpip">USD per pip/lot (override)</Label>
                  <Input
                    id="cfd-usdpip"
                    inputMode="decimal"
                    placeholder={String(spec?.usdPerPipPerLot ?? "")}
                    value={form.usdPerPip}
                    onChange={(event) => set("usdPerPip", event.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cfd-notes">Catatan</Label>
              <textarea
                id="cfd-notes"
                rows={3}
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Setup, alasan entry, pelajaran…"
              />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                Status: <strong>{preview.status === "closed" ? "Closed" : "Running"}</strong>
              </div>
              <div>
                {form.mode === "cfd" ? "Pips" : form.mode === "futures" ? "Ticks" : "Perubahan %"}:{" "}
                {fmtNumber(preview.pips ?? 0, 4)}
              </div>
              <div>Estimasi P&L: ${fmtNumber(preview.pnl ?? 0, 2)}</div>
              {preview.riskReward !== null && <div>R:R: {fmtNumber(preview.riskReward, 2)}</div>}
              {preview.rMultiple !== null && (
                <div>R multiple: {fmtNumber(preview.rMultiple, 2)}R</div>
              )}
              {spec?.note && <p className="text-xs text-muted-foreground">{spec.note}</p>}
            </div>
            {(error || message) && (
              <p className={`text-sm ${error ? "text-destructive" : "text-profit"}`}>
                {error || message}
              </p>
            )}
            <Button onClick={save} disabled={busy || !form.entry || !form.lot}>
              {busy ? "Menyimpan…" : "Simpan trade"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat trade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2">Waktu</th>
                    <th className="p-2">Instrument</th>
                    <th className="p-2">Mode</th>
                    <th className="p-2">Side</th>
                    <th className="p-2">Lot</th>
                    <th className="p-2">Entry</th>
                    <th className="p-2">Pips</th>
                    <th className="p-2">P&L</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className="border-t">
                      <td className="p-2">{new Date(trade.openedAt).toLocaleString()}</td>
                      <td className="p-2">{trade.symbol}</td>
                      <td className="p-2">{MODE_LABELS[trade.mode]}</td>
                      <td className="p-2">{trade.side.toUpperCase()}</td>
                      <td className="p-2">{fmtNumber(trade.lot, 2)}</td>
                      <td className="p-2">{fmtNumber(trade.entry, 4)}</td>
                      <td className="p-2">
                        {trade.pips === null ? "—" : fmtNumber(trade.pips, 1)}
                      </td>
                      <td className="p-2">
                        {trade.pnl === null ? "—" : `$${fmtNumber(trade.pnl, 2)}`}
                      </td>
                      <td className="p-2">{trade.status}</td>
                      <td className="p-2">
                        {trade.status === "running" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const value = window.prompt(
                                "Masukkan hasil akhir (USD), atau 0 untuk breakeven:",
                              );
                              if (value !== null && value.trim() !== "")
                                void closeTrade(trade, Number(value));
                            }}
                          >
                            Tutup
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trades.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Belum ada trade.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
