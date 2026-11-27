"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { VerifiedBadge } from "@/components/verified-badge";
import { SharePreview, type BgTransform } from "@/components/share-preview";
import {
  CERT_HEIGHT,
  CERT_WIDTH,
  downloadBlob,
  renderCertificatePng,
} from "@/lib/certificate-image";
import { exportCanvasVideo } from "@/lib/video-export";
import type { EdgeScoreComponents } from "@luxalgo/journal-core";

interface JournalSummary {
  mode: string;
  label: string;
  trades: number;
  closed: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  profitFactor: number | null;
  edgeScore: number | null;
}

interface Entry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  journalName: string;
  avatarUrl: string | null;
  role: string;
  edgeScore: number | null;
  edgeComponents: EdgeScoreComponents | null;
  netPnl: number;
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null;
  journals: JournalSummary[];
}

const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);
const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const score = (value: number | null) => (value === null ? "—" : value.toFixed(1));

export default function RankingPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rankedAt, setRankedAt] = useState<string | null>(null);
  const [discordUrl, setDiscordUrl] = useState<string>("https://discord.com/");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cert, setCert] = useState<{ entry: Entry } | null>(null);
  const [certBusy, setCertBusy] = useState(false);
  const [certError, setCertError] = useState("");

  // Custom background (image or video) + pan/zoom + opacity for Certificate
  const [bgMedia, setBgMedia] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [bgIsVideo, setBgIsVideo] = useState(false);
  const [bgError, setBgError] = useState("");
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);
  const [transform, setTransform] = useState<BgTransform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    fetch("/api/ranking")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { rankedAt: string; discordUrl?: string; entries: Entry[] }) => {
        setEntries(body.entries);
        setRankedAt(body.rankedAt);
        if (body.discordUrl) setDiscordUrl(body.discordUrl);
      })
      .catch(() => setError("Gagal memuat ranking."));
  }, []);

  useEffect(() => {
    if (bgMedia instanceof HTMLVideoElement) {
      setVideoDuration(bgMedia.duration || 0);
    } else {
      setVideoDuration(0);
      setVideoTime(0);
    }
  }, [bgMedia]);

  const buildCertOptions = useCallback(
    (entry: Entry, transparentBg = false) => ({
      traderName: entry.displayName || entry.username,
      username: `@${entry.username}`,
      journalName: entry.journalName,
      avatarUrl: entry.avatarUrl,
      rank: `Rank #${entry.rank}/${entries.length}`,
      rankNum: entry.rank,
      edgeScore: score(entry.edgeScore),
      edgeComponents: entry.edgeComponents,
      netPnl: entry.netPnl,
      winRate: entry.winRate,
      profitFactor: entry.profitFactor,
      closedTrades: entry.closedTrades,
      downloadDate: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      background: bgMedia,
      transparentBackground: transparentBg,
      overlayOpacity,
      siteUrl: discordUrl,
    }),
    [entries.length, bgMedia, overlayOpacity, discordUrl],
  );

  const renderCertHud = useMemo(() => {
    if (!cert) return undefined;
    return () => renderCertificatePng(buildCertOptions(cert.entry, Boolean(bgMedia)));
  }, [cert, buildCertOptions, bgMedia]);

  const pickFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBgError("");
    setTransform({ offsetX: 0, offsetY: 0, scale: 1 });

    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      try {
        await img.decode();
        setBgMedia(img);
        setBgIsVideo(false);
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
        setBgMedia(video);
        setBgIsVideo(true);
      } catch (e) {
        setBgError(e instanceof Error ? e.message : "Video tidak bisa dibaca.");
      }
      return;
    }
    setBgError("Format tidak didukung. Pilih gambar atau video.");
  }, []);

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

  const downloadCertificate = async () => {
    if (!cert) return;
    setCertBusy(true);
    setCertError("");
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const baseName = `sertifikat-${cert.entry.username}-${dateStr}`;

      if (bgIsVideo && bgMedia instanceof HTMLVideoElement) {
        const hudBlob = await renderCertificatePng(buildCertOptions(cert.entry, true));
        const { blob, extension } = await exportCanvasVideo(
          bgMedia,
          hudBlob,
          CERT_WIDTH,
          CERT_HEIGHT,
          transform,
        );
        downloadBlob(blob, `${baseName}.${extension}`);
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = CERT_WIDTH;
        canvas.height = CERT_HEIGHT;
        const ctx = canvas.getContext("2d")!;

        if (bgMedia) {
          drawBgToCanvas(ctx, bgMedia, CERT_WIDTH, CERT_HEIGHT, transform);
        }

        const hud = await renderCertificatePng(buildCertOptions(cert.entry, Boolean(bgMedia)));
        const hudImg = new Image();
        hudImg.src = URL.createObjectURL(hud);
        await hudImg.decode();
        ctx.drawImage(hudImg, 0, 0, CERT_WIDTH, CERT_HEIGHT);
        URL.revokeObjectURL(hudImg.src);

        const blob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat PNG."))), "image/png"),
        );
        downloadBlob(blob, `${baseName}.png`);
      }
    } catch (cause) {
      setCertError(cause instanceof Error ? cause.message : "Gagal membuat sertifikat.");
    } finally {
      setCertBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title="Ranking Jurnal" />
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <Card>
          <CardContent className="space-y-2 pt-4">
            <h1 className="text-xl font-semibold">Leaderboard Edge Score</h1>
            <p className="text-sm text-muted-foreground">
              Peringkat dihitung dari seluruh jurnal trading di Supabase menggunakan Edge Score v2 —
              kombinasi win rate, profit factor, rasio menang/kalah, drawdown, recovery, dan
              konsistensi. Ranking dapat berubah setiap kali ada trade baru.
            </p>
            {rankedAt && (
              <p className="text-xs text-muted-foreground">
                Dihitung: {new Date(rankedAt).toLocaleString()}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {cert && (
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Certificate of Rank · {cert.entry.journalName}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setCert(null)}>
                Tutup
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="space-y-3">
                <div className="flex justify-center overflow-x-auto">
                  <SharePreview
                    customRender={renderCertHud}
                    dimensions={[CERT_WIDTH, CERT_HEIGHT]}
                    background={bgMedia}
                    transform={transform}
                    onTransformChange={setTransform}
                    displayWidth={Math.min(
                      640,
                      typeof window !== "undefined" ? window.innerWidth - 64 : 640,
                    )}
                  />
                </div>
                {certError && <p className="text-sm text-destructive">{certError}</p>}
                <Button disabled={certBusy} onClick={() => void downloadCertificate()}>
                  {certBusy
                    ? "Memproses…"
                    : bgIsVideo
                      ? "⬇ Unduh sertifikat MP4"
                      : "⬇ Unduh sertifikat PNG"}
                </Button>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Background Certificate (gambar / video)</p>
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
                        setTransform({ offsetX: 0, offsetY: 0, scale: 1 });
                      }}
                    >
                      Gunakan Chart Default
                    </Button>
                  )}
                </div>
                {bgError && <p className="text-xs text-destructive">{bgError}</p>}
                <p className="text-xs text-muted-foreground">
                  {bgIsVideo
                    ? "🎬 Background video — drag untuk geser, scroll/slider untuk zoom. Export otomatis: MP4."
                    : bgMedia
                      ? "🖼 Background gambar — drag untuk geser, scroll/slider untuk zoom. Export otomatis: PNG."
                      : "📈 Background default: Grafik Chart. Export otomatis: PNG."}
                </p>

                {bgMedia && (
                  <div className="space-y-2 border-t pt-2">
                    <div className="space-y-1">
                      <Label>Zoom background ({Math.round(transform.scale * 100)}%)</Label>
                      <input
                        type="range"
                        min={0.5}
                        max={5}
                        step={0.05}
                        value={transform.scale}
                        onChange={(e) =>
                          setTransform({ ...transform, scale: Number(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                    {bgIsVideo && videoDuration > 0 && (
                      <div className="space-y-1">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTransform({ offsetX: 0, offsetY: 0, scale: 1 })}
                    >
                      Reset posisi
                    </Button>
                  </div>
                )}

                <div className="space-y-1 border-t pt-2">
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
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="overflow-x-auto pt-4">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Jurnal</th>
                  <th className="p-2">Pemilik</th>
                  <th className="p-2">Edge</th>
                  <th className="p-2">Trade</th>
                  <th className="p-2">Win rate</th>
                  <th className="p-2">Net P&L</th>
                  <th className="p-2">PF</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Fragment key={entry.userId}>
                    <tr className="border-t">
                      <td className="p-2 font-semibold">{entry.rank}</td>
                      <td className="p-2 font-medium">{entry.journalName}</td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1">
                          {entry.displayName || entry.username}
                          <VerifiedBadge role={entry.role} />
                        </span>
                        <span className="text-muted-foreground"> @{entry.username}</span>
                      </td>
                      <td className="p-2 font-semibold text-brand">{score(entry.edgeScore)}</td>
                      <td className="p-2">{entry.closedTrades}</td>
                      <td className="p-2">{percent(entry.winRate)}</td>
                      <td className={`p-2 ${entry.netPnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {money(entry.netPnl)}
                      </td>
                      <td className="p-2">{score(entry.profitFactor)}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpen(open === entry.userId ? null : entry.userId)}
                          >
                            {open === entry.userId ? "Tutup" : "Detail"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setCert({ entry })}>
                            Sertifikat
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {open === entry.userId && (
                      <tr className="border-t bg-muted/20">
                        <td className="p-3" colSpan={9}>
                          <p className="mb-2 font-medium">Edge score per jurnal</p>
                          {entry.journals.length === 0 && (
                            <p className="text-muted-foreground">Belum ada trade.</p>
                          )}
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {entry.journals.map((journal) => (
                              <div key={journal.mode} className="rounded-md border p-2">
                                <p className="font-medium">{journal.label}</p>
                                <p className="text-muted-foreground">
                                  Edge {score(journal.edgeScore)} · {journal.closed} trade selesai ·{" "}
                                  {percent(journal.winRate)} win · {money(journal.netPnl)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={9}>
                      Belum ada jurnal untuk diranking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
