"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { ImageUploader } from "@/components/image-uploader";
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
  type JournalMode,
  type ResultMode,
  type TradFiCategory,
} from "@/lib/cfd";
import { postJson } from "@/lib/use-api";
import { fmtNumber } from "@/lib/utils";

interface JournalTrade {
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
}

export interface JournalPageProps {
  title: string;
  description: string;
  modes: JournalMode[];
  categories: TradFiCategory[];
  comingSoon?: boolean;
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
};

const nowLocal = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const num = (value: string) => (value.trim() === "" ? undefined : Number(value));

export function JournalPage({
  title,
  description,
  modes,
  categories,
  comingSoon,
}: JournalPageProps) {
  const instruments = useMemo(
    () => INSTRUMENTS.filter((item) => categories.includes(item.class)),
    [categories],
  );
  const [form, setForm] = useState<FormState>(() => ({
    mode: modes[0] ?? "cfd",
    symbol: instruments[0]?.symbol ?? "xyz:EUR",
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
  }));
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/cfd-journal?mode=${modes.join(",")}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { trades: JournalTrade[] }) => setTrades(body.trades))
      .catch(() => setError("Gagal memuat jurnal."));
  };
  useEffect(load, [modes.join(",")]);

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
      const saved = await postJson<{ id: string }>("/api/cfd-journal", {
        ...form,
        lot: num(form.lot),
        entry: num(form.entry),
        takeProfit: num(form.takeProfit),
        stopLoss: num(form.stopLoss),
        exit: num(form.exit),
        manualPnl: num(form.manualPnl),
        leverage: form.mode === "crypto-perp" ? num(form.leverage) : undefined,
        usdPerPip: form.mode === "cfd" ? num(form.usdPerPip) : undefined,
        openedAt: form.openedAt ? new Date(form.openedAt).toISOString() : new Date().toISOString(),
      });
      setSavedId(saved.id);
      for (const file of files) {
        const formImage = new FormData();
        formImage.set("type", "cfd-trade");
        formImage.set("id", saved.id);
        formImage.set("file", file);
        const response = await fetch("/api/attachments", { method: "POST", body: formImage });
        if (!response.ok) throw new Error("Gagal mengunggah gambar.");
      }
      setFiles([]);
      setMessage(
        preview.status === "closed" ? "Trade closed tersimpan." : "Running trade tersimpan.",
      );
      setForm((current) => ({ ...current, entry: "", exit: "", manualPnl: "" }));
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan trade.");
    } finally {
      setBusy(false);
    }
  };

  const closeTrade = async (trade: JournalTrade, result: number) => {
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
    const withR = closed.filter((trade) => trade.rMultiple !== null);
    return {
      total: trades.length,
      running: trades.filter((trade) => trade.status === "running").length,
      closed: closed.length,
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      totalPnl,
      totalPips: closed.reduce((sum, trade) => sum + (trade.pips ?? 0), 0),
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      expectancy: closed.length ? totalPnl / closed.length : 0,
      avgR: withR.length
        ? withR.reduce((sum, trade) => sum + (trade.rMultiple ?? 0), 0) / withR.length
        : 0,
    };
  }, [trades]);

  return (
    <div>
      <FilterBar title={title} />
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">{description}</p>

        {comingSoon ? (
          <Card>
            <CardHeader>
              <CardTitle>Coming soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Jurnal Futures (Tick) akan segera tersedia. Parameter yang disiapkan: ukuran
                kontrak, tick size, nilai per tick, dan kalkulasi P&L berdasarkan tick.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-4 text-xs">
                  Total trade<div className="text-lg font-semibold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  Win rate
                  <div className="text-lg font-semibold">{fmtNumber(stats.winRate, 1)}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  Total P&L
                  <div className="text-lg font-semibold">${fmtNumber(stats.totalPnl, 2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  {form.mode === "cfd" ? "Total pips" : "Total poin / %"}
                  <div className="text-lg font-semibold">{fmtNumber(stats.totalPips, 2)}</div>
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
                  Rata-rata R
                  <div className="text-lg font-semibold">{fmtNumber(stats.avgR, 2)}R</div>
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
                  {modes.length > 1 && (
                    <div className="space-y-1">
                      <Label htmlFor="journal-mode">Mode</Label>
                      <OptionSelect
                        id="journal-mode"
                        value={form.mode}
                        onValueChange={(value) => set("mode", value as JournalMode)}
                      >
                        {modes.map((value) => (
                          <option key={value} value={value}>
                            {MODE_LABELS[value]}
                          </option>
                        ))}
                      </OptionSelect>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="journal-symbol">Instrument</Label>
                    <OptionSelect
                      id="journal-symbol"
                      value={form.symbol}
                      onValueChange={(value) => set("symbol", value)}
                    >
                      {instruments.map((item) => (
                        <option key={item.symbol} value={item.symbol}>
                          [{item.class.toUpperCase()}] {item.label} · {item.symbol}
                        </option>
                      ))}
                    </OptionSelect>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-side">Side</Label>
                    <OptionSelect
                      id="journal-side"
                      value={form.side}
                      onValueChange={(value) => set("side", value as "buy" | "sell")}
                    >
                      <option value="buy">Buy / Long</option>
                      <option value="sell">Sell / Short</option>
                    </OptionSelect>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-lot">
                      {form.mode === "cfd"
                        ? "Lot"
                        : form.mode === "futures"
                          ? "Kontrak"
                          : form.mode === "stock"
                            ? "Nominal masuk (USD)"
                            : form.mode === "crypto-perp"
                              ? "Nominal setelah leverage (USD)"
                              : "Nominal masuk (USD)"}
                    </Label>
                    <Input
                      id="journal-lot"
                      inputMode="decimal"
                      value={form.lot}
                      onChange={(e) => set("lot", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-entry">Entry</Label>
                    <Input
                      id="journal-entry"
                      inputMode="decimal"
                      value={form.entry}
                      onChange={(e) => set("entry", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-opened">Waktu buka</Label>
                    <Input
                      id="journal-opened"
                      type="datetime-local"
                      value={form.openedAt}
                      onChange={(e) => set("openedAt", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-sl">Stop loss</Label>
                    <Input
                      id="journal-sl"
                      inputMode="decimal"
                      value={form.stopLoss}
                      onChange={(e) => set("stopLoss", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-tp">Take profit</Label>
                    <Input
                      id="journal-tp"
                      inputMode="decimal"
                      value={form.takeProfit}
                      onChange={(e) => set("takeProfit", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-exit">Exit (kosong = running)</Label>
                    <Input
                      id="journal-exit"
                      inputMode="decimal"
                      value={form.exit}
                      onChange={(e) => set("exit", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="journal-result">Sumber hasil</Label>
                    <OptionSelect
                      id="journal-result"
                      value={form.resultMode}
                      onValueChange={(value) => set("resultMode", value as ResultMode)}
                    >
                      <option value="auto">Otomatis dari exit</option>
                      <option value="manual">Manual (USD)</option>
                      <option value="breakeven">Breakeven</option>
                    </OptionSelect>
                  </div>
                  {form.resultMode === "manual" && (
                    <div className="space-y-1">
                      <Label htmlFor="journal-pnl">Hasil manual (USD)</Label>
                      <Input
                        id="journal-pnl"
                        inputMode="decimal"
                        value={form.manualPnl}
                        onChange={(e) => set("manualPnl", e.target.value)}
                      />
                    </div>
                  )}
                  {form.mode === "crypto-perp" && (
                    <div className="space-y-1">
                      <Label htmlFor="journal-lev">Leverage (informasi)</Label>
                      <Input
                        id="journal-lev"
                        inputMode="decimal"
                        value={form.leverage}
                        onChange={(e) => set("leverage", e.target.value)}
                      />
                    </div>
                  )}
                  {form.mode === "cfd" && (
                    <div className="space-y-1">
                      <Label htmlFor="journal-usdpip">USD per pip/lot (override)</Label>
                      <Input
                        id="journal-usdpip"
                        inputMode="decimal"
                        placeholder={String(spec?.value ?? "")}
                        value={form.usdPerPip}
                        onChange={(e) => set("usdPerPip", e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="journal-images">Gambar (opsional)</Label>
                  <Input
                    id="journal-images"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                  />
                  {files.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {files.length} gambar akan diunggah.
                    </p>
                  )}
                </div>
                {savedId && (
                  <ImageUploader type="cfd-trade" id={savedId} label="Gambar tersimpan" />
                )}
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div>
                    Status: <strong>{preview.status === "closed" ? "Closed" : "Running"}</strong>
                  </div>
                  <div>
                    {form.mode === "cfd"
                      ? "Pips"
                      : form.mode === "crypto-spot" ||
                          form.mode === "crypto-perp" ||
                          form.mode === "stock"
                        ? "Perubahan %"
                        : "Poin"}
                    : {fmtNumber(preview.pips ?? 0, 4)}
                  </div>
                  {form.mode === "futures" && spec && (
                    <div className="text-xs text-muted-foreground">
                      Tick {spec.step} · ${spec.value}/tick · {spec.tier ?? "standard"}
                    </div>
                  )}
                  <div>Estimasi P&L: ${fmtNumber(preview.pnl ?? 0, 2)}</div>
                  {preview.riskReward !== null && (
                    <div>R:R: {fmtNumber(preview.riskReward, 2)}</div>
                  )}
                  {preview.rMultiple !== null && (
                    <div>R multiple: {fmtNumber(preview.rMultiple, 2)}R</div>
                  )}
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
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Riwayat trade</CardTitle>
                {trades.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Hapus jurnal ini? Seluruh ${trades.length} trade dan semua gambar lampirannya akan dihapus permanen.`,
                        )
                      )
                        return;
                      try {
                        const result = await postJson<{
                          trades: number;
                          images: number;
                        }>(`/api/cfd-journal?mode=${modes[0]}`, undefined, "DELETE");
                        setMessage(
                          `Jurnal dihapus: ${result.trades} trade dan ${result.images} lampiran gambar.`,
                        );
                        load();
                      } catch (cause) {
                        setError(
                          cause instanceof Error ? cause.message : "Gagal menghapus jurnal.",
                        );
                      }
                    }}
                  >
                    Hapus jurnal ini
                  </Button>
                )}
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
                        <th className="p-2">Lot/Size</th>
                        <th className="p-2">Entry</th>
                        <th className="p-2">Hasil</th>
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
                            {trade.pips === null ? "—" : fmtNumber(trade.pips, 2)}
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
                                    "Hasil akhir (USD), atau 0 untuk breakeven:",
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
                    <p className="p-4 text-sm text-muted-foreground">
                      Belum ada trade di jurnal ini.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
