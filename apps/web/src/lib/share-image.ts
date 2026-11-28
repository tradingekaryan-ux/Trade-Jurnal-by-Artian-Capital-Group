import { drawQrCode } from "./barcode";

export type ShareSize = "1920x1080" | "1080x1080";
export type ShareBgTheme = "default" | "dark" | "light";

/** Primary card font matching ApertureRegular from the PDF reference */
export const SANS_FONT =
  '"ArtianSans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Wordmark font matching CocomatPro from the PDF reference */
export const WORDMARK_FONT =
  'Inter, "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export interface ShareStat {
  label: string;
  value: string;
}

export interface ShareStatEx extends ShareStat {
  type?: "pnl" | "factor" | "pill";
}

export interface ShareImageOptions {
  size: ShareSize;
  mode?: "pnl" | "post" | "certificate";
  title: string;
  highlightText?: string;
  pnlValue?: number;
  stats: ShareStatEx[];
  username?: string;
  journalName?: string;
  rankText?: string;
  avatarUrl?: string | null;
  postKind?: "idea" | "promo";
  postDescription?: string;
  postPromoCode?: string | null;
  postDate?: string;
  background?: HTMLImageElement | HTMLVideoElement | null;
  transparentBackground?: boolean;
  overlayOpacity?: number;
  bgTheme?: ShareBgTheme;
  siteUrl?: string;
}

// ─── Asset loaders ────────────────────────────────────────────────────────────

let brandIconPromise: Promise<HTMLImageElement | null> | null = null;
export const loadBrandIcon = (): Promise<HTMLImageElement | null> => {
  if (typeof Image === "undefined") return Promise.resolve(null);
  if (!brandIconPromise) {
    brandIconPromise = (async () => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = "/brand/artian-icon.png";
        await img.decode();
        return img;
      } catch {
        return null;
      }
    })();
  }
  return brandIconPromise;
};

const avatarCache = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Muat gambar avatar. Coba dengan crossOrigin dulu (agar canvas tidak ter-laint
 * saat gambar dari origin lain dengan header CORS). Jika gagal, coba tanpa
 * crossOrigin (berkas same-origin biasanya masih bisa digambar). Jika masih gagal,
 * kembalikan null sehingga pemanggil menggambar placeholder.
 */
export const loadAvatarImage = (url?: string | null): Promise<HTMLImageElement | null> => {
  if (!url || typeof Image === "undefined") return Promise.resolve(null);
  const hit = avatarCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    let img: HTMLImageElement | null = null;
    const tryLoad = (crossOrigin: string | null): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const image = new Image();
        if (crossOrigin) image.crossOrigin = crossOrigin;
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
      });
    img = await tryLoad("anonymous");
    // Fallback via same-origin proxy when external host (e.g. imgdb.io) lacks CORS headers
    // (drawing cross-origin without CORS taints the canvas and breaks canvas.toBlob).
    if (!img && url.startsWith("https://")) {
      const proxyUrl = `/api/avatar-proxy?url=${encodeURIComponent(url)}`;
      img = await new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = proxyUrl;
      });
    } else if (!img && !url.startsWith("http")) {
      img = await tryLoad(null);
    }
    return img;
  })();
  avatarCache.set(url, p);
  return p;
};

let artianFontsPromise: Promise<void> | null = null;
export const loadArtianFonts = (): Promise<void> => {
  if (typeof document === "undefined") return Promise.resolve();
  if (!artianFontsPromise) {
    artianFontsPromise = (async () => {
      try {
        const face = new FontFace("ArtianSans", "url(/fonts/Jura-Regular.ttf)", {
          weight: "300 800",
        });
        document.fonts.add(await face.load());
      } catch {
        /* fallback to system sans */
      }
    })();
  }
  return artianFontsPromise;
};

let sigFontPromise: Promise<void> | null = null;
export const loadSignatureFont = (): Promise<void> => {
  if (typeof document === "undefined") return Promise.resolve();
  if (!sigFontPromise) {
    sigFontPromise = (async () => {
      try {
        const face = new FontFace("EkaSignature", "url(/fonts/Allura-Regular.ttf)");
        document.fonts.add(await face.load());
      } catch {
        /* ignore */
      }
    })();
  }
  return sigFontPromise;
};

// ─── Primitives ───────────────────────────────────────────────────────────────

export const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

/**
 * ARTIAN Capital Group wordmark — exact PDF replica:
 * Geometric white "A" with lime-green inner accent + "ARTIAN" bold white
 * + "Capital Group" lime below.
 */
export const drawArtianWordmark = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
): void => {
  ctx.save();
  const w = h * 1.0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.96, y + h);
  ctx.lineTo(x + w * 0.72, y + h);
  ctx.lineTo(x + w * 0.5, y + h * 0.44);
  ctx.lineTo(x + w * 0.24, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#7CE810";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.54, y + h * 0.58);
  ctx.lineTo(x + w * 0.86, y + h);
  ctx.lineTo(x + w * 0.68, y + h);
  ctx.lineTo(x + w * 0.48, y + h * 0.68);
  ctx.closePath();
  ctx.fill();

  const tx = x + w + h * 0.26;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(h * 0.62)}px ${WORDMARK_FONT}`;
  ctx.fillText("ARTIAN", tx, y - h * 0.03);

  ctx.fillStyle = "#7CE810";
  ctx.font = `400 ${Math.round(h * 0.34)}px ${WORDMARK_FONT}`;
  ctx.fillText("Capital Group", tx, y + h * 0.63);
  ctx.restore();
};

/**
 * Dark candlestick + equity-curve chart background (default when no custom bg).
 */
export const drawDefaultChartBackground = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  accent = "#7CE810",
): void => {
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#05070B");
  bg.addColorStop(0.55, "#0A1119");
  bg.addColorStop(1, "#060B12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo((W / 14) * i, 0);
    ctx.lineTo((W / 14) * i, H);
    ctx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (H / 8) * i);
    ctx.lineTo(W, (H / 8) * i);
    ctx.stroke();
  }

  const startX = W * 0.3,
    chartW = W * 0.68,
    candles = 34;
  const step = chartW / candles;
  let price = H * 0.62;
  const pts: [number, number][] = [];

  for (let i = 0; i < candles; i++) {
    const wave = Math.sin(i * 0.48) * H * 0.038 + Math.cos(i * 0.23) * H * 0.025;
    const open = price;
    const close = Math.max(H * 0.18, Math.min(H * 0.82, open - H * 0.009 + wave * 0.55));
    const isBull = close < open;
    const high = Math.min(open, close) - (Math.abs(Math.sin(i * 1.7)) * H * 0.045 + 6);
    const low = Math.max(open, close) + (Math.abs(Math.cos(i * 1.3)) * H * 0.045 + 6);
    const cx = startX + i * step + step * 0.5;
    const cw = Math.max(6, step * 0.56);
    const col = isBull ? "#22C55E" : "#EF4444";
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, high);
    ctx.lineTo(cx, low);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.globalAlpha = isBull ? 0.45 : 0.38;
    ctx.fillRect(cx - cw / 2, Math.min(open, close), cw, Math.max(4, Math.abs(close - open)));
    pts.push([cx, (open + close) / 2]);
    price = close;
  }
  if (pts.length > 1) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], H);
    for (const [px, py] of pts) ctx.lineTo(px, py);
    ctx.lineTo(pts[pts.length - 1]![0], H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * Left-to-right black → transparent gradient overlay matching the PDF reference.
 */
export const drawBlackLeftGradient = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  overlayOpacity = 0.85,
): void => {
  const op = Math.max(0, Math.min(1, overlayOpacity));
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.35, "rgba(0,0,0,0.98)");
  g.addColorStop(0.54, `rgba(0,0,0,${(0.45 * op).toFixed(3)})`);
  g.addColorStop(1, `rgba(0,0,0,${(0.08 * op).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

/**
 * Circular avatar badge (PDF bottom-left / certificate top-right).
 */
export const drawUserBadge = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  avatarSize: number,
  username: string,
  journalName: string,
  rankText: string,
  accentColor: string,
  avatarImg?: HTMLImageElement | null,
): void => {
  ctx.save();
  const r = avatarSize / 2;
  const cx = x + r,
    cy = y + r;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#87CEEB";
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImg && avatarImg.naturalWidth > 0) {
    const sc = Math.max(avatarSize / avatarImg.naturalWidth, avatarSize / avatarImg.naturalHeight);
    const dw = avatarImg.naturalWidth * sc,
      dh = avatarImg.naturalHeight * sc;
    ctx.drawImage(avatarImg, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    const skyGrad = ctx.createLinearGradient(x, y, x, y + avatarSize);
    skyGrad.addColorStop(0, "#B8E6FF");
    skyGrad.addColorStop(0.65, "#E0F4FF");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(x, y, avatarSize, avatarSize);

    ctx.fillStyle = "#9CCC3B";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.15, cy + r * 0.72, r * 1.1, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6B9B1E";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.5, cy + r * 0.82, r * 0.85, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx - r * 0.1, cy - r * 0.25, r * 0.28, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.18, cy - r * 0.2, r * 0.21, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(2.5, avatarSize * 0.042);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const tx = x + avatarSize + Math.round(avatarSize * 0.25);
  const lineH = avatarSize * 0.32;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${Math.round(avatarSize * 0.245)}px ${SANS_FONT}`;
  ctx.fillText(username.slice(0, 28), tx, y + avatarSize * 0.04);

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = `400 ${Math.round(avatarSize * 0.245)}px ${SANS_FONT}`;
  ctx.fillText(journalName.slice(0, 30), tx, y + lineH + avatarSize * 0.02);

  if (rankText) {
    ctx.fillStyle = accentColor;
    ctx.font = `600 ${Math.round(avatarSize * 0.275)}px ${SANS_FONT}`;
    ctx.fillText(rankText.slice(0, 24), tx, y + lineH * 2);
  }
  ctx.restore();
};

/** White-background QR code tile (PDF bottom-right). */
export const drawQrTile = (
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  size: number,
): void => {
  ctx.save();
  const pad = Math.round(size * 0.1);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x - pad, y - pad, size + pad * 2, size + pad * 2, Math.round(size * 0.1));
  ctx.fill();
  drawQrCode(ctx, url, x, y, size, "#000000", "rgba(255,255,255,0)");
  ctx.restore();
};

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

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
};

// ─── Main renderers ───────────────────────────────────────────────────────────

export const renderSharePng = async (options: ShareImageOptions): Promise<Blob> => {
  const [, avatarImg] = await Promise.all([loadArtianFonts(), loadAvatarImage(options.avatarUrl)]);

  const [W, H] = options.size === "1920x1080" ? [1920, 1080] : [1080, 1080];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  const isLandscape = W > H;

  const pnlStat = options.stats.find((s) => s.type === "pnl") ?? options.stats[0];
  const isLoss =
    options.pnlValue !== undefined
      ? options.pnlValue < 0
      : (pnlStat?.value.trim().startsWith("-") ?? false);
  const accent = isLoss ? "#E62020" : "#7CE810";

  const pad = Math.round(W * 0.036);

  // ── 1. Background ─────────────────────────────────────────────────────────
  if (!options.transparentBackground) {
    if (options.background) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      coverMedia(ctx, options.background, W, H);
    } else {
      drawDefaultChartBackground(ctx, W, H, accent);
    }
  }
  // Saat background custom dipakai, gradient hanya menutup panel kiri agar
  // gambar/video tidak tertutup seluruhnya (menyebabkan background "hilang").
  if (options.transparentBackground) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W * 0.72, H);
    ctx.clip();
    drawBlackLeftGradient(ctx, W, H, options.overlayOpacity ?? 0.85);
    ctx.restore();
  } else {
    drawBlackLeftGradient(ctx, W, H, options.overlayOpacity ?? 0.85);
  }

  // ── 2. ARTIAN Capital Group logo (top-left) ───────────────────────────────
  const logoH = Math.round(H * (isLandscape ? 0.082 : 0.07));
  const logoY = Math.round(H * 0.048);
  drawArtianWordmark(ctx, pad, logoY, logoH);

  if (options.mode === "post") {
    // ── POST / REPOST card — matching PDF font, colors & black/lime identity ─
    const cardX = pad;
    const cardY = Math.round(H * 0.205);
    const cardW = Math.round(W * (isLandscape ? 0.51 : 0.88));
    const cardH = Math.round(H * 0.635);

    ctx.fillStyle = "rgba(8, 10, 14, 0.90)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(124, 232, 16, 0.45)";
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.stroke();

    const ip = Math.round(cardW * 0.052);

    // Repost pill bar
    const pillText = `↻ REPOST · ${options.postKind === "idea" ? "TRADE IDEA" : "PROMO & DISCOUNT"}`;
    ctx.font = `600 ${Math.round(H * 0.022)}px ${SANS_FONT}`;
    const pillW = ctx.measureText(pillText).width + 32;
    const pillH = Math.round(H * 0.046);
    ctx.fillStyle = "#7CE810";
    ctx.fillRect(cardX + ip, cardY + ip, pillW, pillH);
    ctx.fillStyle = "#050608";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(pillText, cardX + ip + 16, cardY + ip + pillH / 2 + 1);

    // Author badge
    drawUserBadge(
      ctx,
      cardX + ip,
      cardY + ip + pillH + Math.round(H * 0.028),
      Math.round(H * 0.082),
      options.username ?? "@username",
      options.journalName ?? "Artian Capital",
      options.postDate ?? "",
      "#7CE810",
      avatarImg,
    );

    // Title
    const titleY = cardY + ip + pillH + Math.round(H * 0.145);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `600 ${Math.round(H * 0.046)}px ${SANS_FONT}`;
    const titleLines = wrapText(ctx, options.title, cardW - ip * 2, 2);
    titleLines.forEach((ln, i) => ctx.fillText(ln, cardX + ip, titleY + i * Math.round(H * 0.056)));

    // Description
    const descY = titleY + titleLines.length * Math.round(H * 0.056) + Math.round(H * 0.02);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = `400 ${Math.round(H * 0.028)}px ${SANS_FONT}`;
    const descLines = wrapText(ctx, options.postDescription ?? "", cardW - ip * 2, 4);
    descLines.forEach((ln, i) => ctx.fillText(ln, cardX + ip, descY + i * Math.round(H * 0.038)));

    // Promo code bar
    if (options.postPromoCode) {
      const py = cardY + cardH - ip - Math.round(H * 0.068);
      const pText = `PROMO CODE: ${options.postPromoCode}`;
      ctx.font = `700 ${Math.round(H * 0.026)}px ${SANS_FONT}`;
      const pw = ctx.measureText(pText).width + 36;
      const ph = Math.round(H * 0.056);
      ctx.fillStyle = "#7CE810";
      ctx.fillRect(cardX + ip, py, pw, ph);
      ctx.fillStyle = "#050608";
      ctx.textBaseline = "middle";
      ctx.fillText(pText, cardX + ip + 18, py + ph / 2 + 1);
    }
  } else if (options.mode === "certificate") {
    // ── Certificate of Rank (PDF Page 3 style) ──────────────────────────────
    renderCertificateContent(ctx, options, W, H, pad, isLandscape, avatarImg, accent);
  } else {
    // ── PnL Share Layout — exact PDF replica (Pages 1 & 2) ──────────────────
    renderPnlContent(ctx, options, W, H, pad, isLandscape, avatarImg, accent);
  }

  // ── 4. QR code tile (bottom-right) ───────────────────────────────────────
  const qrSize = Math.round(H * (isLandscape ? 0.205 : 0.17));
  const siteUrl =
    options.siteUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://artian.capital");
  drawQrTile(ctx, siteUrl, W - pad - qrSize, H - pad - qrSize, qrSize);

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat PNG."))), "image/png"),
  );
};

function renderPnlContent(
  ctx: CanvasRenderingContext2D,
  options: ShareImageOptions,
  W: number,
  H: number,
  pad: number,
  isLandscape: boolean,
  avatarImg: HTMLImageElement | null,
  accent: string,
): void {
  const pnlStat = options.stats.find((s) => s.type === "pnl") ?? options.stats[0];

  // ── Title: BUY/SELL – SYMBOL ──────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  const titleFontSize = Math.round(H * (isLandscape ? 0.07 : 0.058));
  ctx.font = `600 ${titleFontSize}px ${SANS_FONT}`;
  ctx.fillText(options.title.toUpperCase().slice(0, 26), pad, H * 0.3);

  // ── Solid lime/red highlight bar ──────────────────────────────────────────
  const barY = H * 0.4;
  const barW = W * (isLandscape ? 0.3 : 0.6);
  const barH = H * 0.095;
  ctx.fillStyle = accent;
  ctx.fillRect(pad, barY, barW, barH);

  const hlText = options.highlightText ?? pnlStat?.value ?? "+$0.00";
  ctx.fillStyle = "#050608";
  ctx.font = `700 ${Math.round(barH * 0.62)}px ${SANS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hlText.slice(0, 24), pad + barW / 2, barY + barH / 2 + 1, barW - 24);

  // ── 2-column Key-Value Rows ───────────────────────────────────────────────
  const tableStats = options.stats.filter((s) => s.type !== "pnl").slice(0, 4);
  const rowStartY = H * 0.58;
  const rowH = H * 0.075;
  const valX = pad + W * (isLandscape ? 0.16 : 0.3);
  const statFont = `400 ${Math.round(H * 0.04)}px ${SANS_FONT}`;

  tableStats.forEach((st, i) => {
    const ry = rowStartY + i * rowH;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = statFont;
    ctx.fillText(st.label.slice(0, 14), pad, ry);
    ctx.fillText(st.value.slice(0, 26), valX, ry, W * 0.35);
  });

  // ── Bottom-left user badge ────────────────────────────────────────────────
  const avSize = Math.round(H * (isLandscape ? 0.1 : 0.115));
  drawUserBadge(
    ctx,
    pad,
    H - pad - avSize,
    avSize,
    options.username ?? "@username",
    options.journalName ?? "Nama Jurnal",
    options.rankText ?? "",
    accent,
    avatarImg,
  );
}

function renderCertificateContent(
  ctx: CanvasRenderingContext2D,
  options: ShareImageOptions,
  W: number,
  H: number,
  pad: number,
  isLandscape: boolean,
  avatarImg: HTMLImageElement | null,
  accent: string,
): void {
  // ── Certificate of Rank ───────────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${Math.round(H * 0.05)}px ${SANS_FONT}`;
  ctx.fillText("Certificate of Rank", pad, H * 0.235);

  const barY = H * 0.275;
  const barW = W * (isLandscape ? 0.28 : 0.45);
  const barH = H * 0.085;
  ctx.fillStyle = accent;
  ctx.fillRect(pad, barY, barW, barH);
  ctx.fillStyle = "#050608";
  ctx.font = `600 ${Math.round(barH * 0.65)}px ${SANS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(options.rankText ?? "Rank #1", pad + barW / 2, barY + barH / 2 + 1);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${Math.round(H * 0.05)}px ${SANS_FONT}`;
  ctx.fillText(
    `Edge Score ${options.stats.find((s) => s.label === "Edge Score")?.value ?? "—"}`,
    pad,
    H * 0.405,
  );

  // ── Stats rows ────────────────────────────────────────────────────────────
  const rowStartY = H * 0.5;
  const rowH = H * 0.07;
  const statFont = `400 ${Math.round(H * 0.036)}px ${SANS_FONT}`;
  options.stats.slice(0, 5).forEach((st, i) => {
    const ry = rowStartY + i * rowH;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = statFont;
    ctx.fillText(st.label.slice(0, 16), pad, ry);
    ctx.fillText(st.value.slice(0, 24), pad + W * 0.22, ry, W * 0.25);
  });

  // ── Bottom-left signature ─────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.font = `400 ${Math.round(H * 0.1)}px EkaSignature, "Segoe Script", cursive`;
  ctx.fillText("Eka Ryan", pad, H - pad - 30);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `400 ${Math.round(H * 0.03)}px ${SANS_FONT}`;
  ctx.fillText("Pt. Eka Ryan M..", pad + Math.round(H * 0.12), H - pad + 12);

  // ── Top-right user badge (glass card) ─────────────────────────────────────
  const ucW = W * 0.2,
    ucH = H * 0.135;
  const ucX = W - pad - ucW,
    ucY = pad;
  ctx.fillStyle = "rgba(12, 15, 20, 0.72)";
  roundRect(ctx, ucX, ucY, ucW, ucH, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, ucX, ucY, ucW, ucH, 20);
  ctx.stroke();

  drawUserBadge(
    ctx,
    ucX + Math.round(ucW * 0.05),
    ucY + Math.round(ucH * 0.1),
    Math.round(ucH * 0.75),
    options.username ?? "@username",
    options.journalName ?? "Nama Jurnal",
    options.rankText ?? "",
    accent,
    avatarImg,
  );
}

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
