"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { ImageUploader } from "@/components/image-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import {
  INSTRUMENTS,
  MODE_LABELS,
  SIZE_LABEL,
  calculateJournal,
  formatTradeMove,
  formatTradeSize,
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
  const [form, setForm] = useState<FormState>(() => {
    const initialMode = modes[0] ?? "cfd";
    return {
      mode: initialMode,
      symbol: instruments[0]?.symbol ?? "xyz:EUR",
      side: "buy",
      lot: initialMode === "cfd" || initialMode === "futures" ? "1" : "1000",
      entry: "",
      takeProfit: "",
      stopLoss: "",
      exit: "",
      resultMode: "auto",
      manualPnl: "",
      leverage: "1",
      usdPerPip: "",
      openedAt: nowLocal(),
    };
  });
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [review, setReview] = useState<{ title: string; text: string; model: string } | null>(null);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

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

  const applyRr = (multiple: number) => {
    const entry = num(form.entry);
    const stop = num(form.stopLoss);
    if (!entry || !stop) {
      setError("Isi Entry dan Stop loss terlebih dahulu.");
      return;
    }
    const risk = Math.abs(entry - stop);
    const direction = form.side === "buy" ? 1 : -1;
    const decimals = entry < 10 ? 5 : 2;
    set("takeProfit", Number((entry + direction * risk * multiple).toFixed(decimals)).toString());
  };

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

  const reviewTrade = async (trade: JournalTrade) => {
    setReviewBusy(trade.id);
    setError("");
    try {
      const result = await postJson<{ review: string; model: string; imagesUsed: number }>(
        "/api/cfd-journal/ai-review",
        { id: trade.id },
      );
      setReview({
        title: `${trade.symbol} · ${new Date(trade.openedAt).toLocaleDateString()}`,
        text: result.review,
        model: `${result.model}${result.imagesUsed ? ` · ${result.imagesUsed} gambar` : ""}`,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat AI review.");
    } finally {
      setReviewBusy(null);
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
            <div className="terminal-tape">
              {[
                { label: "Total trade", value: String(stats.total) },
                { label: "Win rate", value: `${fmtNumber(stats.winRate, 1)}%` },
                {
                  label: "Net P&L",
                  value: `${stats.totalPnl >= 0 ? "+" : "−"}$${fmtNumber(
                    Math.abs(stats.totalPnl),
                    2,
                  )}`,
                  tone: stats.totalPnl > 0 ? "positive" : stats.totalPnl < 0 ? "negative" : "",
                },
                {
                  label: form.mode === "cfd" ? "Total pips" : "Total poin / %",
                  value: fmtNumber(stats.totalPips, 2),
                },
                {
                  label: "Profit factor",
                  value: Number.isFinite(stats.profitFactor)
                    ? fmtNumber(stats.profitFactor, 2)
                    : "∞",
                },
                {
                  label: "Expectancy",
                  value: `$${fmtNumber(stats.expectancy, 2)}`,
                  tone: stats.expectancy > 0 ? "positive" : stats.expectancy < 0 ? "negative" : "",
                },
                { label: "Avg R", value: `${fmtNumber(stats.avgR, 2)}R` },
                {
                  label: "Running / Closed",
                  value: `${stats.running} / ${stats.closed}`,
                },
              ].map((cell) => (
                <div className="terminal-tape-cell" key={cell.label}>
                  <span className="terminal-label">{cell.label}</span>
                  <span
                    className={`terminal-value ${
                      cell.tone === "positive"
                        ? "terminal-positive"
                        : cell.tone === "negative"
                          ? "terminal-negative"
                          : ""
                    }`}
                  >
                    {cell.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="execution-panel">
              <div className="execution-head">
                <span className="execution-head-title">
                  Execution desk / {MODE_LABELS[form.mode]}
                </span>
                <span className="execution-tag" data-tone={form.side}>
                  <span className="execution-dot" />
                  {form.side === "buy" ? "BUY" : "SELL"}
                </span>
                <span className="execution-tag">
                  {preview.status === "closed" ? "CLOSED" : "RUNNING"}
                </span>
                <span className="execution-tag">{form.symbol}</span>
              </div>

              <div className="execution-body">
                <div className="execution-form">
                  <section>
                    <p className="execution-section-label">01 · Instrumen &amp; arah</p>
                    <div className="execution-grid">
                      {modes.length > 1 && (
                        <div className="execution-field">
                          <label htmlFor="journal-mode">Mode</label>
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
                      <div className="execution-field">
                        <label htmlFor="journal-symbol">Instrument</label>
                        <OptionSelect
                          id="journal-symbol"
                          value={form.symbol}
                          onValueChange={(value) => set("symbol", value)}
                        >
                          {instruments.map((item) => (
                            <option key={item.symbol} value={item.symbol}>
                              {item.symbol} · {item.label}
                            </option>
                          ))}
                        </OptionSelect>
                      </div>
                      <div className="execution-field">
                        <label htmlFor="journal-opened">Waktu buka</label>
                        <Input
                          id="journal-opened"
                          type="datetime-local"
                          value={form.openedAt}
                          onChange={(e) => set("openedAt", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="execution-side-toggle mt-3">
                      <button
                        type="button"
                        data-side="buy"
                        data-active={form.side === "buy"}
                        onClick={() => set("side", "buy")}
                      >
                        BUY / LONG
                      </button>
                      <button
                        type="button"
                        data-side="sell"
                        data-active={form.side === "sell"}
                        onClick={() => set("side", "sell")}
                      >
                        SELL / SHORT
                      </button>
                    </div>
                  </section>

                  <section>
                    <p className="execution-section-label">02 · Parameter order</p>
                    <div className="execution-grid">
                      <div className="execution-field">
                        <label htmlFor="journal-lot">{SIZE_LABEL[form.mode]}</label>
                        <Input
                          id="journal-lot"
                          inputMode="decimal"
                          placeholder={
                            form.mode === "cfd" ? "0.10" : form.mode === "futures" ? "1" : "1000"
                          }
                          value={form.lot}
                          onChange={(e) => set("lot", e.target.value)}
                        />
                      </div>
                      <div className="execution-field">
                        <label htmlFor="journal-entry">Entry</label>
                        <Input
                          id="journal-entry"
                          inputMode="decimal"
                          value={form.entry}
                          onChange={(e) => set("entry", e.target.value)}
                        />
                      </div>
                      <div className="execution-field">
                        <label htmlFor="journal-sl">Stop loss</label>
                        <Input
                          id="journal-sl"
                          inputMode="decimal"
                          value={form.stopLoss}
                          onChange={(e) => set("stopLoss", e.target.value)}
                        />
                      </div>
                      <div className="execution-field">
                        <label htmlFor="journal-tp">Take profit</label>
                        <Input
                          id="journal-tp"
                          inputMode="decimal"
                          value={form.takeProfit}
                          onChange={(e) => set("takeProfit", e.target.value)}
                        />
                      </div>
                      <div className="execution-field">
                        <label htmlFor="journal-exit">Exit · kosong = running</label>
                        <Input
                          id="journal-exit"
                          inputMode="decimal"
                          value={form.exit}
                          onChange={(e) => set("exit", e.target.value)}
                        />
                      </div>
                      <div className="execution-field">
                        <label htmlFor="journal-result">Sumber hasil</label>
                        <OptionSelect
                          id="journal-result"
                          value={form.resultMode}
                          onValueChange={(value) => set("resultMode", value as ResultMode)}
                        >
                          <option value="auto">Auto dari exit</option>
                          <option value="manual">Manual USD</option>
                          <option value="breakeven">Breakeven</option>
                        </OptionSelect>
                      </div>
                      {form.resultMode === "manual" && (
                        <div className="execution-field">
                          <label htmlFor="journal-pnl">Hasil manual (USD)</label>
                          <Input
                            id="journal-pnl"
                            inputMode="decimal"
                            value={form.manualPnl}
                            onChange={(e) => set("manualPnl", e.target.value)}
                          />
                        </div>
                      )}
                      {form.mode === "crypto-perp" && (
                        <div className="execution-field">
                          <label htmlFor="journal-lev">Leverage</label>
                          <Input
                            id="journal-lev"
                            inputMode="decimal"
                            value={form.leverage}
                            onChange={(e) => set("leverage", e.target.value)}
                          />
                        </div>
                      )}
                      {form.mode === "cfd" && (
                        <div className="execution-field">
                          <label htmlFor="journal-usdpip">USD / pip override</label>
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
                    <div className="execution-quick mt-3">
                      <span className="terminal-label mr-1">TP dari risk</span>
                      <button type="button" onClick={() => applyRr(1)}>
                        1R
                      </button>
                      <button type="button" onClick={() => applyRr(2)}>
                        2R
                      </button>
                      <button type="button" onClick={() => applyRr(3)}>
                        3R
                      </button>
                    </div>
                  </section>

                  <section>
                    <p className="execution-section-label">03 · Bukti order</p>
                    <input
                      id="journal-images"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    />
                    <label htmlFor="journal-images" className="execution-file">
                      + Lampirkan screenshot (PNG / JPG / WEBP)
                    </label>
                    {files.length > 0 && (
                      <p className="terminal-label mt-2">{files.length} file siap diunggah</p>
                    )}
                    {savedId && (
                      <div className="mt-3">
                        <ImageUploader type="cfd-trade" id={savedId} label="Gambar tersimpan" />
                      </div>
                    )}
                  </section>
                </div>

                <aside className="execution-rail">
                  <p className="execution-rail-title">Order preview</p>
                  <span className="terminal-label">Estimasi P&amp;L</span>
                  <div
                    className={`execution-pnl ${
                      (preview.pnl ?? 0) > 0
                        ? "terminal-positive"
                        : (preview.pnl ?? 0) < 0
                          ? "terminal-negative"
                          : ""
                    }`}
                  >
                    {(preview.pnl ?? 0) >= 0 ? "+" : "−"}${fmtNumber(Math.abs(preview.pnl ?? 0), 2)}
                  </div>
                  <div className="execution-metric">
                    <span>Status</span>
                    <strong>{preview.status === "closed" ? "CLOSED" : "RUNNING"}</strong>
                  </div>
                  <div className="execution-metric">
                    <span>{form.mode === "cfd" ? "Pips" : "Poin / %"}</span>
                    <strong>{fmtNumber(preview.pips ?? 0, 4)}</strong>
                  </div>
                  <div className="execution-metric">
                    <span>R : R</span>
                    <strong>
                      {preview.riskReward === null ? "—" : fmtNumber(preview.riskReward, 2)}
                    </strong>
                  </div>
                  <div className="execution-metric">
                    <span>R multiple</span>
                    <strong>
                      {preview.rMultiple === null ? "—" : `${fmtNumber(preview.rMultiple, 2)}R`}
                    </strong>
                  </div>
                  {form.mode === "futures" && spec && (
                    <div className="execution-metric">
                      <span>Tick</span>
                      <strong>
                        {spec.step} / ${spec.value}
                      </strong>
                    </div>
                  )}
                  <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                    {formatTradeSize(form.mode, num(form.lot) ?? 0)} · {spec?.tier ?? "standard"} ·
                    kontrak dicatat di Supabase.
                  </p>
                </aside>
              </div>

              <div className="execution-foot">
                {(error || message) && (
                  <p
                    className={`execution-note flex-1 ${error ? "text-destructive" : "terminal-positive"}`}
                  >
                    {error || message}
                  </p>
                )}
                <button
                  type="button"
                  className="execution-submit"
                  onClick={save}
                  disabled={busy || !form.entry || !form.lot}
                >
                  {busy ? "MENGIRIM ORDER…" : "KIRIM ORDER · SIMPAN TRADE"}
                </button>
              </div>
            </div>

            {review && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle>AI review · {review.title}</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setReview(null)}>
                    Tutup
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="whitespace-pre-wrap text-sm">{review.text}</p>
                  <p className="text-xs text-muted-foreground">Model: {review.model}</p>
                </CardContent>
              </Card>
            )}

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
                        }>(
                          `/api/cfd-journal?mode=${encodeURIComponent(modes.join(","))}`,
                          undefined,
                          "DELETE",
                        );
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
                  <table className="w-full text-left font-mono text-[11px] tnum">
                    <thead className="text-muted-foreground">
                      <tr>
                        {[
                          "Waktu",
                          "Instrument",
                          "Mode",
                          "Side",
                          "Size / Nilai",
                          "Entry",
                          "Hasil",
                          "P&L",
                          "Status",
                          "Aksi",
                        ].map((head) => (
                          <th
                            key={head}
                            className="border-b p-2 text-[9px] font-semibold uppercase tracking-[0.12em]"
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade) => (
                        <tr key={trade.id} className="border-t">
                          <td className="p-2">{new Date(trade.openedAt).toLocaleString()}</td>
                          <td className="p-2">{trade.symbol}</td>
                          <td className="p-2">{MODE_LABELS[trade.mode]}</td>
                          <td className="p-2">{trade.side.toUpperCase()}</td>
                          <td className="p-2">{formatTradeSize(trade.mode, trade.lot)}</td>
                          <td className="p-2">{fmtNumber(trade.entry, 4)}</td>
                          <td className="p-2">{formatTradeMove(trade.mode, trade.pips)}</td>
                          <td className="p-2">
                            {trade.pnl === null ? "—" : `$${fmtNumber(trade.pnl, 2)}`}
                          </td>
                          <td className="p-2">{trade.status}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1.5">
                              <Link
                                href={`/share?tab=pnl&scope=trade&journal=${encodeURIComponent(trade.mode)}&tradeId=${encodeURIComponent(trade.id)}`}
                              >
                                <Button size="sm" variant="outline">
                                  PnL Share
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reviewBusy !== null}
                                onClick={() => void reviewTrade(trade)}
                              >
                                {reviewBusy === trade.id ? "AI…" : "AI review"}
                              </Button>
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
                            </div>
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
