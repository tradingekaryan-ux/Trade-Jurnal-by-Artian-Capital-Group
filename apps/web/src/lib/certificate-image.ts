/**
 * Certificate of Rank — 1920×1080, matching the PnL Card & PDF reference style:
 *   - Left column:
 *       ARTIAN Capital Group logo
 *       "Certificate of Rank" (white)
 *       Solid lime-green #7CE810 bar with "Rank #X/Y" (black text)
 *       "Edge Score X" (white)
 *       6-row key-value table (Win%, Profit Factor, Avg Win/Loss, Drawdown, Recovery, Consistency — 0–100)
 *       Handwritten CEO signature "Eka Ryan" + "Pt. Eka Ryan M.."
 *   - Right section:
 *       Default candlestick chart OR custom image/video background
 *       Top-right dark translucent glass card with circular avatar + @username + journal + rank
 *       Bottom-right crisp QR code tile
 */
import type { EdgeScoreComponents } from "@luxalgo/journal-core";
import {
  SANS_FONT,
  drawArtianWordmark,
  drawBlackLeftGradient,
  drawDefaultChartBackground,
  drawQrTile,
  drawUserBadge,
  loadArtianFonts,
  loadAvatarImage,
  loadSignatureFont,
  roundRect,
  downloadBlob,
} from "./share-image";

export { downloadBlob };

export const CERT_WIDTH = 1920;
export const CERT_HEIGHT = 1080;

export interface CertificateOptions {
  traderName: string;
  username?: string;
  journalName?: string;
  avatarUrl?: string | null;
  rank?: string;
  rankNum?: number;
  edgeScore?: string;
  edgeComponents?: EdgeScoreComponents | null;
  netPnl?: number;
  period?: string;
  downloadDate?: string;
  winRate?: number | null;
  profitFactor?: number | null;
  closedTrades?: number;
  background?: HTMLImageElement | HTMLVideoElement | null;
  transparentBackground?: boolean;
  overlayOpacity?: number;
  siteUrl?: string;
}

const coverMedia = (
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  W: number,
  H: number,
): void => {
  const sw = media instanceof HTMLVideoElement ? media.videoWidth : (media.naturalWidth ?? 0);
  const sh = media instanceof HTMLVideoElement ? media.videoHeight : (media.naturalHeight ?? 0);
  if (!sw || !sh) return;
  const sc = Math.max(W / sw, H / sh);
  ctx.drawImage(media, (W - sw * sc) / 2, (H - sh * sc) / 2, sw * sc, sh * sc);
};

export const renderCertificatePng = async (opt: CertificateOptions): Promise<Blob> => {
  const [, , avatarImg] = await Promise.all([
    loadArtianFonts(),
    loadSignatureFont(),
    loadAvatarImage(opt.avatarUrl),
  ]);

  const W = CERT_WIDTH,
    H = CERT_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const pad = 68;
  const lime = "#7CE810";

  // ── 1. Background ─────────────────────────────────────────────────────────
  if (!opt.transparentBackground) {
    if (opt.background) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
      coverMedia(ctx, opt.background, W, H);
    } else {
      drawDefaultChartBackground(ctx, W, H, lime);
    }
  }
  if (opt.transparentBackground) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W * 0.72, H);
    ctx.clip();
    drawBlackLeftGradient(ctx, W, H, opt.overlayOpacity ?? 0.85);
    ctx.restore();
  } else {
    drawBlackLeftGradient(ctx, W, H, opt.overlayOpacity ?? 0.85);
  }

  // ── 2. ARTIAN Capital Group logo (top-left) ───────────────────────────────
  drawArtianWordmark(ctx, pad, 52, 88);

  // ── 3. Certificate of Rank + Green Rank Bar + Edge Score ──────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 50px ${SANS_FONT}`;
  ctx.fillText("Certificate of Rank", pad, 238);

  const barY = 262,
    barW = 468,
    barH = 76;
  ctx.fillStyle = lime;
  ctx.fillRect(pad, barY, barW, barH);
  ctx.fillStyle = "#050608";
  ctx.font = `600 42px ${SANS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(opt.rank ?? "Rank #1", pad + barW / 2, barY + barH / 2 + 2);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 48px ${SANS_FONT}`;
  ctx.fillText(`Edge Score ${opt.edgeScore ?? "—"}`, pad, 412);

  // ── 4. Edge Score 6-Component Table (same style as PnL Card) ─────────────
  const comp = opt.edgeComponents;
  const fmtScore = (v?: number) => (v !== undefined ? `${Math.round(v)} / 100` : "—");
  const rows: Array<{ label: string; value: string }> = [
    { label: "Win%", value: fmtScore(comp?.winRate) },
    { label: "Profit Factor", value: fmtScore(comp?.profitFactor) },
    { label: "Avg Win/Loss", value: fmtScore(comp?.avgWinLoss) },
    { label: "Drawdown", value: fmtScore(comp?.drawdown) },
    { label: "Recovery", value: fmtScore(comp?.recovery) },
    { label: "Consistency", value: fmtScore(comp?.consistency) },
  ];

  const rowStartY = 482;
  const rowGap = 54;
  const valX = pad + Math.round(W * 0.165);
  ctx.font = `400 36px ${SANS_FONT}`;
  rows.forEach((row, i) => {
    const ry = rowStartY + i * rowGap;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`${row.label}:`, pad, ry);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(row.value, valX, ry);
  });

  // ── 5. Bottom-Left Signature ──────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `400 100px EkaSignature, "Segoe Script", cursive`;
  ctx.fillText("Eka Ryan", pad, H - 108);

  ctx.fillStyle = "#ffffff";
  ctx.font = `400 28px ${SANS_FONT}`;
  ctx.fillText("Pt. Eka Ryan M..", pad + 98, H - 46);

  // ── 6. Top-Right User Glass Card ──────────────────────────────────────────
  const ucW = 420,
    ucH = 148;
  const ucX = W - pad - ucW,
    ucY = 42;
  ctx.fillStyle = "rgba(12, 15, 20, 0.72)";
  roundRect(ctx, ucX, ucY, ucW, ucH, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, ucX, ucY, ucW, ucH, 24);
  ctx.stroke();

  drawUserBadge(
    ctx,
    ucX + 22,
    ucY + 20,
    108,
    opt.username ?? `@${opt.traderName}`,
    opt.journalName ?? "Nama Jurnal",
    opt.rank ?? "Rank #1",
    lime,
    avatarImg,
  );

  // ── 7. Bottom-Right Crisp QR Code ─────────────────────────────────────────
  const qrSize = 230;
  const siteUrl =
    opt.siteUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://artian.capital");
  drawQrTile(ctx, siteUrl, W - pad - qrSize, H - pad - qrSize, qrSize);

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat PNG."))), "image/png"),
  );
};
