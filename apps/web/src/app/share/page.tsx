"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { ShareControls, type ShareSettings } from "@/components/share-controls";
import { downloadBlob, renderSharePng, type ShareStat } from "@/lib/share-image";

interface ShareTrade {
  id: string;
  symbol: string;
  mode: string;
  side: string;
  lot: number;
  entry: number;
  exitPrice: number | null;
  pnl: number | null;
  pips: number | null;
  rMultiple: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

interface SharePost {
  id: string;
  kind: string;
  title: string;
  description: string;
  promoCode: string | null;
  url: string | null;
  createdAt: string;
}

interface ShareData {
  journalName: string;
  displayName: string;
  username: string;
  rank: number | null;
  totalParticipants: number;
  trades: ShareTrade[];
  posts: SharePost[];
}

type Scope = "trade" | "day" | "week" | "month" | "year" | "all";
type Tab = "pnl" | "journal" | "post";

const money = (value: number) =>
  `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const summarise = (trades: ShareTrade[]): ShareStat[] => {
  const closed = trades.filter((trade) => trade.status === "closed");
  const wins = closed.filter((trade) => (trade.pnl ?? 0) > 0);
  const net = closed.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  return [
    { label: "Total trade", value: String(trades.length) },
    { label: "Trade selesai", value: String(closed.length) },
    { label: "Menang", value: String(wins.length) },
    { label: "Kalah", value: String(closed.filter((t) => (t.pnl ?? 0) < 0).length) },
    {
      label: "Win rate",
      value: closed.length ? `${((wins.length / closed.length) * 100).toFixed(1)}%` : "—",
    },
    { label: "Net P&L", value: money(net) },
  ];
};

const inScope = (trade: ShareTrade, scope: Scope, now: Date): boolean => {
  if (scope === "all") return true;
  const date = new Date(trade.closedAt ?? trade.openedAt);
  if (Number.isNaN(date.getTime())) return false;
  if (scope === "day") return date.toDateString() === now.toDateString();
  if (scope === "week") return now.getTime() - date.getTime() <= 7 * 86400_000;
  if (scope === "month")
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  return date.getFullYear() === now.getFullYear();
};

export default function SharePage() {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("pnl");
  const [scope, setScope] = useState<Scope>("week");
  const [tradeId, setTradeId] = useState("");
  const [postId, setPostId] = useState("");
  const [settings, setSettings] = useState<ShareSettings>({
    size: "1920x1080",
    background: null,
    error: "",
  });

  useEffect(() => {
    fetch("/api/share/data")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: ShareData) => {
        setData(body);
        setTradeId(body.trades[0]?.id ?? "");
        setPostId(body.posts[0]?.id ?? "");
      })
      .catch(() => setError("Gagal memuat data share."));
  }, []);

  const selectedTrade = useMemo(
    () => data?.trades.find((trade) => trade.id === tradeId) ?? data?.trades[0],
    [data, tradeId],
  );
  const scopedTrades = useMemo(() => {
    if (!data) return [];
    if (scope === "trade") return selectedTrade ? [selectedTrade] : [];
    return data.trades.filter((trade) => inScope(trade, scope, new Date()));
  }, [data, scope, selectedTrade]);
  const selectedPost = data?.posts.find((post) => post.id === postId) ?? data?.posts[0];

  const generate = async () => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
      let title = "";
      let subtitle = "";
      let stats: ShareStat[] = [];
      let note = "";
      let filename = "";

      if (tab === "pnl") {
        const label: Record<Scope, string> = {
          trade: "Per Trade",
          day: "Per Hari",
          week: "Per Minggu",
          month: "Per Bulan",
          year: "Per Tahun",
          all: "All Time",
        };
        title = `PnL Share · ${label[scope]}`;
        subtitle = `${data.journalName} · ${data.displayName}`;
        if (scope === "trade" && selectedTrade) {
          stats = [
            { label: "Simbol", value: selectedTrade.symbol },
            { label: "Mode", value: selectedTrade.mode },
            { label: "Side", value: selectedTrade.side.toUpperCase() },
            { label: "Entry", value: String(selectedTrade.entry) },
            { label: "Exit", value: String(selectedTrade.exitPrice ?? "—") },
            { label: "Pips", value: String(selectedTrade.pips ?? "—") },
            { label: "R multiple", value: String(selectedTrade.rMultiple ?? "—") },
            { label: "P&L", value: money(selectedTrade.pnl ?? 0) },
          ];
          note = new Date(selectedTrade.openedAt).toLocaleString();
        } else {
          stats = summarise(scopedTrades);
          note = `${scopedTrades.length} trade dari ${data.journalName}`;
        }
        filename = `pnl-${scope}-${data.username}`;
      } else if (tab === "journal") {
        title = "Jurnal PnL Share";
        subtitle = `${data.journalName} · ${data.displayName}`;
        stats = [
          ...summarise(data.trades),
          { label: "Peringkat", value: data.rank ? `#${data.rank}` : "—" },
          { label: "Peserta", value: String(data.totalParticipants) },
        ];
        note = "Seluruh jurnal CFD, Futures, Crypto, dan Stock di Supabase.";
        filename = `jurnal-pnl-${data.username}`;
      } else if (selectedPost) {
        title = selectedPost.kind === "idea" ? "Trades Idea Share" : "Promo & Discount Share";
        subtitle = `${selectedPost.title.slice(0, 70)} · ${data.displayName}`;
        stats = [
          { label: "Jenis", value: selectedPost.kind === "idea" ? "Trades Idea" : "Promo" },
          { label: "Pemilik", value: `@${data.username}` },
          { label: "Promo code", value: selectedPost.promoCode || "—" },
          { label: "Tanggal", value: new Date(selectedPost.createdAt).toLocaleDateString() },
        ];
        note = selectedPost.description.slice(0, 220) || (selectedPost.url ?? "");
        filename = `postingan-${selectedPost.kind}-${data.username}`;
      }

      const blob = await renderSharePng({
        size: settings.size,
        title,
        subtitle,
        stats,
        note,
        background: settings.background,
        siteUrl,
      });
      downloadBlob(blob, `${filename}.png`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat PNG.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title="PnL & Post Share" />
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <Card>
          <CardContent className="pt-4">
            <h1 className="text-xl font-semibold">Bagikan hasil trading Anda</h1>
            <p className="text-sm text-muted-foreground">
              Semua PNG dirender langsung di browser Anda. Gambar/video background tidak pernah
              diunggah ke server.
            </p>
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!data ? (
          <p className="text-sm text-muted-foreground">Memuat data…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["pnl", "PnL per Periode"],
                  ["journal", "Jurnal PnL"],
                  ["post", "Postingan"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={tab === id ? "default" : "outline"}
                  onClick={() => setTab(id)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pengaturan gambar</CardTitle>
              </CardHeader>
              <CardContent>
                <ShareControls value={settings} onChange={setSettings} />
              </CardContent>
            </Card>

            {tab === "pnl" && (
              <Card>
                <CardHeader>
                  <CardTitle>Pilih periode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <OptionSelect value={scope} onValueChange={(value) => setScope(value as Scope)}>
                    <option value="trade">Per Trade</option>
                    <option value="day">Per Day</option>
                    <option value="week">Per Week</option>
                    <option value="month">Per Month</option>
                    <option value="year">Per Year</option>
                    <option value="all">All Time</option>
                  </OptionSelect>
                  {scope === "trade" && (
                    <div className="space-y-1">
                      <Label>Trade</Label>
                      <OptionSelect value={tradeId} onValueChange={setTradeId}>
                        {data.trades.slice(0, 100).map((trade) => (
                          <option key={trade.id} value={trade.id}>
                            {new Date(trade.openedAt).toLocaleDateString()} · {trade.symbol} ·{" "}
                            {money(trade.pnl ?? 0)}
                          </option>
                        ))}
                      </OptionSelect>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {scopedTrades.length} trade akan dimasukkan ke dalam statistik PNG.
                  </p>
                </CardContent>
              </Card>
            )}

            {tab === "post" && (
              <Card>
                <CardHeader>
                  <CardTitle>Pilih postingan</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.posts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada postingan.</p>
                  ) : (
                    <OptionSelect value={postId} onValueChange={setPostId}>
                      {data.posts.map((post) => (
                        <option key={post.id} value={post.id}>
                          {post.kind === "idea" ? "[Idea] " : "[Promo] "}
                          {post.title}
                        </option>
                      ))}
                    </OptionSelect>
                  )}
                </CardContent>
              </Card>
            )}

            <Button disabled={busy} onClick={() => void generate()}>
              {busy ? "Membuat PNG…" : "Download PNG"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
