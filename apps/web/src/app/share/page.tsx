"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { formatTradeSize } from "@/lib/cfd";
import { SharePreview, type BgTransform } from "@/components/share-preview";
import { BackgroundControls } from "@/components/background-controls";
import {
  downloadBlob,
  renderSharePng,
  type ShareImageOptions,
  type ShareSize,
  type ShareStatEx,
} from "@/lib/share-image";
import { exportCanvasVideo } from "@/lib/video-export";

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
  avatarUrl: string | null;
  discordUrl?: string;
  rank: number | null;
  totalParticipants: number;
  trades: ShareTrade[];
  posts: SharePost[];
}

type Scope = "trade" | "day" | "week" | "month" | "year" | "all";
type Tab = "pnl" | "journal" | "post";
type PnlUnit = "usd" | "percent";

const money = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const pctText = (pnl: number, equity: number) => {
  const base = equity > 0 ? equity : 10000;
  const pct = (pnl / base) * 100;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%`;
};

const summarise = (trades: ShareTrade[]): { net: number; stats: ShareStatEx[] } => {
  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const net = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossG = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossL = losses.reduce((s, t) => s + Math.abs(t.pnl ?? 0), 0);
  const pf = closed.length > 0 ? (grossL > 0 ? (grossG / grossL).toFixed(2) : "∞") : "—";
  const wr = closed.length ? `${((wins.length / closed.length) * 100).toFixed(2)}%` : "—";
  return {
    net,
    stats: [
      { label: "Net P&L", value: `${money(net)} USD`, type: "pnl" },
      { label: "Win Rate", value: wr },
      { label: "Profit Factor", value: pf },
      { label: "Trades Won", value: `${wins.length} / ${closed.length}` },
      { label: "Volume", value: `${closed.length} trades` },
    ],
  };
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

const scopeLabels: Record<Scope, string> = {
  trade: "Per Trade",
  day: "Daily PnL",
  week: "Weekly PnL",
  month: "Monthly PnL",
  year: "Yearly PnL",
  all: "All Time PnL",
};

const journalModeLabels: Record<string, string> = {
  all: "Semua Jurnal",
  cfd: "CFD / Forex",
  futures: "Futures",
  "crypto-spot": "Crypto Spot",
  "crypto-perp": "Crypto Perp",
  stock: "Stock",
};

export default function SharePage() {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("pnl");
  const [scope, setScope] = useState<Scope>("day");
  const [journalFilter, setJournalFilter] = useState<string>("all");
  const [pnlUnit, setPnlUnit] = useState<PnlUnit>("usd");
  const [equityBase, setEquityBase] = useState<string>("10000");
  const [tradeId, setTradeId] = useState("");
  const [postId, setPostId] = useState("");
  const [size, setSize] = useState<ShareSize>("1920x1080");
  const [bgMedia, setBgMedia] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [bgIsVideo, setBgIsVideo] = useState(false);
  const [bgError, setBgError] = useState("");
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);
  const [transform, setTransform] = useState<BgTransform>({ offsetX: 0, offsetY: 0, scale: 1 });
  // Naik setiap kali background diganti → paksa preview render ulang dengan state terbaru.
  const [bgVersion, setBgVersion] = useState(0);
  const resetTransform = useCallback(() => setTransform({ offsetX: 0, offsetY: 0, scale: 1 }), []);
  const applyBackground = useCallback(
    (media: HTMLImageElement | HTMLVideoElement, video: boolean) => {
      setBgMedia(media);
      setBgIsVideo(video);
      setOverlayOpacity(0.65);
      resetTransform();
      setBgVersion((v) => v + 1);
    },
    [resetTransform],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    const params =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const qTab = params?.get("tab");
    const qScope = params?.get("scope");
    const qJournal = params?.get("journal");
    const qTradeId = params?.get("tradeId");
    if (qTab === "pnl" || qTab === "journal" || qTab === "post") setTab(qTab);
    if (
      qScope === "trade" ||
      qScope === "day" ||
      qScope === "week" ||
      qScope === "month" ||
      qScope === "year" ||
      qScope === "all"
    ) {
      setScope(qScope);
    }
    if (qJournal) setJournalFilter(qJournal);

    fetch("/api/share/data")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: ShareData) => {
        setData(body);
        setTradeId(
          qTradeId && body.trades.some((t) => t.id === qTradeId)
            ? qTradeId
            : (body.trades[0]?.id ?? ""),
        );
        setPostId(body.posts[0]?.id ?? "");
      })
      .catch(() => setError("Gagal memuat data share."));
  }, []);

  const availableJournals = useMemo(() => {
    if (!data) return ["all"];
    const modes = Array.from(new Set(data.trades.map((t) => t.mode).filter(Boolean)));
    return ["all", ...modes];
  }, [data]);

  const journalTrades = useMemo(() => {
    if (!data) return [];
    if (journalFilter === "all") return data.trades;
    return data.trades.filter((t) => t.mode === journalFilter);
  }, [data, journalFilter]);

  const selectedTrade = useMemo(
    () => journalTrades.find((t) => t.id === tradeId) ?? journalTrades[0],
    [journalTrades, tradeId],
  );
  const scopedTrades = useMemo(() => {
    if (scope === "trade") return selectedTrade ? [selectedTrade] : [];
    return journalTrades.filter((t) => inScope(t, scope, new Date()));
  }, [journalTrades, scope, selectedTrade]);
  const selectedPost = data?.posts.find((p) => p.id === postId) ?? data?.posts[0];

  useEffect(() => {
    if (bgMedia instanceof HTMLVideoElement) {
      setVideoDuration(bgMedia.duration || 0);
    } else {
      setVideoDuration(0);
      setVideoTime(0);
    }
  }, [bgMedia]);

  const shareOptions = useMemo<ShareImageOptions | null>(() => {
    if (!data) return null;
    const siteUrl =
      data.discordUrl ||
      (typeof window !== "undefined" ? window.location.origin : "https://discord.com/");
    const journalLabel = journalModeLabels[journalFilter] ?? journalFilter.toUpperCase();
    const rankText = data.rank ? `Rank #${data.rank}/${data.totalParticipants}` : "";

    if (tab === "post" && selectedPost) {
      return {
        size,
        mode: "post",
        title: selectedPost.title,
        stats: [],
        username: `@${data.username}`,
        journalName: data.journalName,
        avatarUrl: data.avatarUrl,
        postKind: selectedPost.kind === "idea" ? "idea" : "promo",
        postDescription: selectedPost.description,
        postPromoCode: selectedPost.promoCode,
        postDate: new Date(selectedPost.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        background: bgMedia,
        overlayOpacity,
        siteUrl,
      };
    }

    const equityNum = Math.max(1, Number(equityBase) || 10000);
    const fmtHighlight = (val: number) =>
      pnlUnit === "percent" ? pctText(val, equityNum) : `${money(val)} USD`;

    if (tab === "pnl" && scope === "trade" && selectedTrade) {
      const pnl = selectedTrade.pnl ?? 0;
      const secondaryPnl =
        pnlUnit === "percent"
          ? `${money(pnl)} USD`
          : equityNum > 0
            ? pctText(pnl, equityNum)
            : selectedTrade.rMultiple != null
              ? `${selectedTrade.rMultiple.toFixed(2)}R`
              : "—";
      return {
        size,
        mode: "pnl",
        title: `${selectedTrade.side.toUpperCase()} — ${selectedTrade.symbol}`,
        highlightText: fmtHighlight(pnl),
        pnlValue: pnl,
        stats: [
          { label: "Size", value: formatTradeSize(selectedTrade.mode, selectedTrade.lot) },
          { label: "PnL", value: secondaryPnl },
          { label: "Entry", value: String(selectedTrade.entry) },
          { label: "Exit", value: String(selectedTrade.exitPrice ?? "—") },
        ],
        username: `@${data.username}`,
        journalName: `${data.journalName} · ${journalLabel}`,
        rankText,
        avatarUrl: data.avatarUrl,
        background: bgMedia,
        overlayOpacity,
        siteUrl,
      };
    }

    const tradesToSum = tab === "journal" ? journalTrades : scopedTrades;
    const { net, stats } = summarise(tradesToSum);
    return {
      size,
      mode: "pnl",
      title: tab === "journal" ? journalLabel : scopeLabels[scope],
      highlightText: fmtHighlight(net),
      pnlValue: net,
      stats:
        pnlUnit === "percent"
          ? stats.map((s) => (s.type === "pnl" ? { ...s, value: `${money(net)} USD` } : s))
          : stats,
      username: `@${data.username}`,
      journalName: data.journalName,
      rankText,
      avatarUrl: data.avatarUrl,
      background: bgMedia,
      overlayOpacity,
      siteUrl,
    };
  }, [
    data,
    tab,
    scope,
    journalFilter,
    journalTrades,
    scopedTrades,
    selectedTrade,
    selectedPost,
    size,
    bgMedia,
    overlayOpacity,
    pnlUnit,
    equityBase,
  ]);

  const pickFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setBgError("");

      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        try {
          await img.decode();
          applyBackground(img, false);
        } catch {
          setBgError("Gambar tidak bisa dibaca.");
        }
        return;
      }
      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.preload = "auto";
        video.playsInline = true;
        try {
          await new Promise<void>((res, rej) => {
            if (video.readyState >= 1) {
              res();
              return;
            }
            video.onloadedmetadata = () => res();
            video.onerror = () => rej(new Error("Video tidak bisa dibaca."));
          });
          video.currentTime = 0;
          await new Promise<void>((res) => {
            video.onseeked = () => res();
            window.setTimeout(res, 1500);
          });
          applyBackground(video, true);
        } catch (e) {
          setBgError(e instanceof Error ? e.message : "Video tidak bisa dibaca.");
        }
        return;
      }
      setBgError("Format tidak didukung. Pilih gambar atau video.");
    },
    [applyBackground],
  );

  const seekVideo = useCallback(
    (t: number) => {
      setVideoTime(t);
      if (bgMedia instanceof HTMLVideoElement) bgMedia.currentTime = t;
    },
    [bgMedia],
  );

  const drawBgToCanvas = (
    ctx: CanvasRenderingContext2D,
    media: HTMLImageElement | HTMLVideoElement,
    cW: number,
    cH: number,
    tf: BgTransform,
  ) => {
    const sw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const sh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (!sw || !sh) return;
    const base = Math.max(cW / sw, cH / sh);
    const fs = base * tf.scale;
    const dw = sw * fs;
    const dh = sh * fs;
    ctx.drawImage(media, (cW - dw) / 2 + tf.offsetX, (cH - dh) / 2 + tf.offsetY, dw, dh);
  };

  const exportAuto = async () => {
    if (!shareOptions) return;
    setBusy(true);
    setError("");
    try {
      const [cW, cH] = size === "1920x1080" ? [1920, 1080] : [1080, 1080];
      const baseName = `artian-${tab}-${new Date().toISOString().slice(0, 10)}`;

      if (bgIsVideo && bgMedia instanceof HTMLVideoElement) {
        const hudBlob = await renderSharePng({
          ...shareOptions,
          background: null,
          transparentBackground: true,
        });
        const { blob, extension } = await exportCanvasVideo(bgMedia, hudBlob, cW, cH, transform);
        downloadBlob(blob, `${baseName}.${extension}`);
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = cW;
        canvas.height = cH;
        const ctx = canvas.getContext("2d")!;

        if (bgMedia) {
          drawBgToCanvas(ctx, bgMedia, cW, cH, transform);
        }

        const hud = await renderSharePng({
          ...shareOptions,
          background: null,
          transparentBackground: Boolean(bgMedia),
        });
        const hudImg = new Image();
        hudImg.src = URL.createObjectURL(hud);
        await hudImg.decode();
        ctx.drawImage(hudImg, 0, 0, cW, cH);
        URL.revokeObjectURL(hudImg.src);

        const blob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat PNG."))), "image/png"),
        );
        downloadBlob(blob, `${baseName}.png`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengekspor media.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title="PnL & Post Share" />
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <Card>
          <CardContent className="pt-4">
            <h1 className="text-xl font-semibold">Bagikan hasil trading Anda</h1>
            <p className="text-sm text-muted-foreground">
              Default menggunakan background grafik chart. Anda dapat mengganti background dengan
              gambar (export PNG) atau video (export MP4) langsung di browser.
            </p>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!data ? (
          <p className="text-sm text-muted-foreground">Memuat data…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center overflow-x-auto pb-4">
                  {shareOptions && (
                    <SharePreview
                      key={`bg-${bgVersion}`}
                      options={shareOptions}
                      background={bgMedia}
                      transform={transform}
                      onTransformChange={setTransform}
                      displayWidth={Math.min(
                        680,
                        typeof window !== "undefined" ? window.innerWidth - 48 : 680,
                      )}
                    />
                  )}
                </CardContent>
              </Card>

              {bgMedia && (
                <Card>
                  <CardContent className="space-y-4 pt-4">
                    <BackgroundControls transform={transform} onChange={setTransform} />
                    {bgIsVideo && videoDuration > 0 && (
                      <div className="space-y-1 border-t pt-3">
                        <Label>Frame video (detik ke-{videoTime.toFixed(1)})</Label>
                        <input
                          type="range"
                          min={0}
                          max={videoDuration}
                          step={0.1}
                          value={videoTime}
                          onChange={(e) => seekVideo(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button disabled={busy} onClick={() => void exportAuto()}>
                {busy ? "Memproses…" : bgIsVideo ? "⬇ Download MP4" : "⬇ Download PNG"}
              </Button>
            </div>

            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>Jenis share</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(["pnl", "journal", "post"] as Tab[]).map((id) => (
                      <Button
                        key={id}
                        size="sm"
                        variant={tab === id ? "default" : "outline"}
                        onClick={() => setTab(id)}
                      >
                        {id === "pnl"
                          ? "PnL per Periode"
                          : id === "journal"
                            ? "Jurnal PnL"
                            : "Postingan"}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ukuran output</CardTitle>
                </CardHeader>
                <CardContent>
                  <OptionSelect value={size} onValueChange={(v) => setSize(v as ShareSize)}>
                    <option value="1920x1080">1920 × 1080 (landscape)</option>
                    <option value="1080x1080">1080 × 1080 (square)</option>
                  </OptionSelect>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Background (gambar / video)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => void pickFile(e.target.files?.[0])}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                      Pilih gambar / video…
                    </Button>
                    {bgMedia && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setBgMedia(null);
                          setBgIsVideo(false);
                          setOverlayOpacity(0.85);
                          resetTransform();
                          setBgVersion((v) => v + 1);
                        }}
                      >
                        Gunakan Chart Default
                      </Button>
                    )}
                  </div>
                  {bgError && <p className="text-xs text-destructive">{bgError}</p>}
                  <p className="text-xs text-muted-foreground">
                    {bgIsVideo
                      ? "Background video ≤15 detik. Geser dengan tombol atau drag di preview, zoom dengan tombol. Export: MP4."
                      : bgMedia
                        ? "Background gambar. Geser dengan tombol atau drag di preview, zoom dengan tombol. Export: PNG."
                        : "Background default: grafik chart. Export otomatis: PNG."}
                  </p>
                  <div className="space-y-1 pt-2 border-t">
                    <Label>Opacity overlay kanan ({Math.round(overlayOpacity * 100)}%)</Label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>

              {(tab === "pnl" || tab === "journal") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Jurnal &amp; Periode</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label>Format PnL (Bar Merah/Hijau)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant={pnlUnit === "usd" ? "default" : "outline"}
                          onClick={() => setPnlUnit("usd")}
                        >
                          USD ($)
                        </Button>
                        <Button
                          size="sm"
                          variant={pnlUnit === "percent" ? "default" : "outline"}
                          onClick={() => setPnlUnit("percent")}
                        >
                          % Kenaikan Equity
                        </Button>
                      </div>
                    </div>
                    {pnlUnit === "percent" && (
                      <div className="space-y-1">
                        <Label>Modal / Equity Awal Jurnal (USD)</Label>
                        <input
                          type="number"
                          min={1}
                          step="any"
                          value={equityBase}
                          onChange={(e) => setEquityBase(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          placeholder="10000"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Pilih Jurnal</Label>
                      <OptionSelect value={journalFilter} onValueChange={setJournalFilter}>
                        {availableJournals.map((mode) => (
                          <option key={mode} value={mode}>
                            {journalModeLabels[mode] ?? mode.toUpperCase()}
                          </option>
                        ))}
                      </OptionSelect>
                    </div>
                    {tab === "pnl" && (
                      <>
                        <div className="space-y-1">
                          <Label>Periode</Label>
                          <OptionSelect value={scope} onValueChange={(v) => setScope(v as Scope)}>
                            <option value="trade">Per Trade</option>
                            <option value="day">Daily (Hari Ini)</option>
                            <option value="week">Weekly (7 Hari)</option>
                            <option value="month">Monthly (Bulan Ini)</option>
                            <option value="year">Yearly (Tahun Ini)</option>
                            <option value="all">All Time</option>
                          </OptionSelect>
                        </div>
                        {scope === "trade" && (
                          <div className="space-y-1">
                            <Label>Trade</Label>
                            <OptionSelect value={tradeId} onValueChange={setTradeId}>
                              {journalTrades.slice(0, 100).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {new Date(t.openedAt).toLocaleDateString()} · {t.symbol} ·{" "}
                                  {money(t.pnl ?? 0)}
                                </option>
                              ))}
                            </OptionSelect>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {scopedTrades.length} trade dalam jurnal &amp; periode ini.
                        </p>
                      </>
                    )}
                    {tab === "journal" && (
                      <p className="text-xs text-muted-foreground">
                        {journalTrades.length} total trade pada jurnal terpilih.
                      </p>
                    )}
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
                        {data.posts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.kind === "idea" ? "[Idea] " : "[Promo] "}
                            {p.title}
                          </option>
                        ))}
                      </OptionSelect>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
