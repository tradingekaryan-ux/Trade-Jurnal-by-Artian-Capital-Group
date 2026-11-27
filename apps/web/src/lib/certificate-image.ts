/**
 * Certificate of Rank — 1920×1080, exact PDF reference replica (Pages 3, 4, 5).
 *
 * Layout:
 *   - Left column:
 *       ARTIAN Capital Group logo
 *       "Certificate of Rank" (white)
 *       Solid lime-green #7CE810 bar with "Rank #X/Y" (black text)
 *       "Edge Score X" (white)
 *       6-axis hexagonal radar chart (green fill #22C55E / #4ADE80)
 *       Handwritten CEO signature "Eka Ryan" + "Pt. Eka Ryan M.."
 *   - Right section:
 *       Default candlestick chart OR custom image/video background
 *       Top-right dark translucent glass card with circular avatar + @username + journal + rank
 *       Bottom-right crisp QR code tile
 */
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

export const CERT_WIDTH  = 1920;
export const CERT_HEIGHT = 1080;

export interface CertificateOptions {
  traderName: string;
  username?: string;
  journalName?: string;
  avatarUrl?: string | null;
  rank?: string;
  rankNum?: number;
  edgeScore?: string;
  netPnl?: number;
  period?: string;
  downloadDate?: string;
  winRate?: number | null;
  profitFactor?: number | null;
  closedTrades?: number;
  radarValues?: [number, number, number, number, number, number];
  background?: HTMLImageElement | HTMLVideoElement | null;
  transparentBackground?: boolean;
  overlayOpacity?: number;
  siteUrl?: string;
}

const coverMedia = (
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  W: number, H: number,
): void => {
  const sw = media instanceof HTMLVideoElement ? media.videoWidth  : (media.naturalWidth  ?? 0);
  const sh = media instanceof HTMLVideoElement ? media.videoHeight : (media.naturalHeight ?? 0);
  if (!sw || !sh) return;
  const sc = Math.max(W / sw, H / sh);
  ctx.drawImage(media, (W - sw * sc) / 2, (H - sh * sc) / 2, sw * sc, sh * sc);
};

/**
 * 6-axis hexagonal radar chart — exact PDF Pages 3-5 style:
 * Subtle white concentric rings, axis spokes, green filled polygon,
 * and labels ["Win %", "Profit factor", "Avg win/loss", "Drawdown", "Recovery", "Consistency"].
 */
const drawRadarChart = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  values: [number, number, number, number, number, number],
): void => {
  const labels = ["Win %", "Profit factor", "Avg win/loss", "Drawdown", "Recovery", "Consistency"];
  const N = 6;
  ctx.save();

  for (let ring = 1; ring <= 4; ring++) {
    const r = (radius * ring) / 4;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const ex = cx + radius * Math.cos(a), ey = cy + radius * Math.sin(a);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();

    const lx = cx + (radius + 22) * Math.cos(a), ly = cy + (radius + 22) * Math.sin(a);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `500 17px ${SANS_FONT}`;
    ctx.textBaseline = "middle";
    if (Math.abs(Math.cos(a)) < 0.15) ctx.textAlign = "center";
    else ctx.textAlign = Math.cos(a) > 0 ? "left" : "right";
    ctx.fillText(labels[i]!, lx, ly);
  }

  ctx.beginPath();
  values.forEach((v, i) => {
    const c = Math.max(0.08, Math.min(1, v));
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const px = cx + radius * c * Math.cos(a), py = cy + radius * c * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(34, 197, 94, 0.68)";
  ctx.fill();
  ctx.strokeStyle = "#4ADE80";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
};

export const renderCertificatePng = async (opt: CertificateOptions): Promise<Blob> => {
  const [, , avatarImg] = await Promise.all([
    loadArtianFonts(),
    loadSignatureFont(),
    loadAvatarImage(opt.avatarUrl),
  ]);

  const W = CERT_WIDTH, H = CERT_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
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
  drawBlackLeftGradient(ctx, W, H, opt.overlayOpacity ?? 0.85);

  // ── 2. ARTIAN Capital Group logo (top-left) ───────────────────────────────
  drawArtianWordmark(ctx, pad, 52, 88);

  // ── 3. Certificate of Rank + Green Rank Bar + Edge Score ──────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 52px ${SANS_FONT}`;
  ctx.fillText("Certificate of Rank", pad, 256);

  const barY = 282, barW = 468, barH = 80;
  ctx.fillStyle = lime;
  ctx.fillRect(pad, barY, barW, barH);
  ctx.fillStyle = "#050608";
  ctx.font = `600 44px ${SANS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(opt.rank ?? "Rank #1", pad + barW / 2, barY + barH / 2 + 2);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 52px ${SANS_FONT}`;
  ctx.fillText(`Edge Score ${opt.edgeScore ?? "—"}`, pad, 442);

  // ── 4. 6-Axis Radar Chart ─────────────────────────────────────────────────
  const radarVals: [number, number, number, number, number, number] =
    opt.radarValues ?? [0.75, 0.70, 0.65, 0.72, 0.78, 0.68];
  drawRadarChart(ctx, pad + 228, 624, 122, radarVals);

  // ── 5. Bottom-Left Signature ──────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `400 106px EkaSignature, "Segoe Script", cursive`;
  ctx.fillText("Eka Ryan", pad, H - 120);

  ctx.fillStyle = "#ffffff";
  ctx.font = `400 28px ${SANS_FONT}`;
  ctx.fillText("Pt. Eka Ryan M..", pad + 98, H - 54);

  // ── 6. Top-Right User Glass Card ──────────────────────────────────────────
  const ucW = 420, ucH = 148;
  const ucX = W - pad - ucW, ucY = 42;
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
  const siteUrl = opt.siteUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://artian.capital");
  drawQrTile(ctx, siteUrl, W - pad - qrSize, H - pad - qrSize, qrSize);

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat PNG."))), "image/png"),
  );
};
