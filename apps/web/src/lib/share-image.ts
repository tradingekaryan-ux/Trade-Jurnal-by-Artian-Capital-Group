import { drawBarcode } from "./barcode";

export type ShareSize = "1920x1080" | "1080x1080";

export interface ShareStat {
  label: string;
  value: string;
}

export interface ShareImageOptions {
  size: ShareSize;
  title: string;
  subtitle?: string;
  stats: ShareStat[];
  background?: HTMLImageElement | HTMLVideoElement | null;
  note?: string;
  issuedAt?: string;
  siteUrl?: string;
}

let signaturePromise: Promise<void> | null = null;

/** Load the signature-like font once, entirely in the browser. */
const loadSignatureFont = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  if (!signaturePromise) {
    signaturePromise = (async () => {
      try {
        const face = new FontFace("EkaSignature", "url(/fonts/Allura-Regular.ttf)");
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch {
        // Fall back to an italic serif if the font cannot be loaded.
      }
    })();
  }
  await signaturePromise;
  try {
    await document.fonts.load("72px EkaSignature");
  } catch {
    // Ignore font-loading failures.
  }
};

const cover = (
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number,
) => {
  const sourceWidth =
    media instanceof HTMLVideoElement ? media.videoWidth : (media.naturalWidth ?? 0);
  const sourceHeight =
    media instanceof HTMLVideoElement ? media.videoHeight : (media.naturalHeight ?? 0);
  if (!sourceWidth || !sourceHeight) return false;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(media, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return true;
};

const shortDate = (value?: string): string => {
  if (!value) return new Date().toLocaleString("en-GB", { timeZone: "UTC" });
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
};

/** Render a shareable PNG offline on the client canvas. */
export const renderSharePng = async (options: ShareImageOptions): Promise<Blob> => {
  await loadSignatureFont();
  const [width, height] = options.size === "1920x1080" ? [1920, 1080] : [1080, 1080];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung canvas.");

  // Background: user-supplied still image or a frame of a ≤15s video.
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, width, height);
  if (options.background && !cover(ctx, options.background, width, height)) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0b3d2e");
    gradient.addColorStop(1, "#111827");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = "rgba(3, 10, 20, 0.72)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(12, 163, 12, 0.9)";
  ctx.fillRect(0, 0, width, Math.max(8, height * 0.008));

  const pad = Math.round(width * 0.055);
  const titleSize = Math.round(height * (options.size === "1080x1080" ? 0.07 : 0.075));
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${titleSize}px sans-serif`;
  ctx.fillText(options.title.slice(0, 60), pad, Math.round(height * 0.16), width - pad * 2);
  if (options.subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = `${Math.round(height * 0.028)}px sans-serif`;
    ctx.fillText(options.subtitle.slice(0, 110), pad, Math.round(height * 0.215), width - pad * 2);
  }

  let y = Math.round(height * 0.32);
  const rowGap = Math.round(height * (options.stats.length > 6 ? 0.063 : 0.078));
  const columns = width > 1200 && options.stats.length > 4 ? 2 : 1;
  const columnWidth = (width - pad * 2) / columns;
  options.stats.slice(0, 12).forEach((stat, index) => {
    const column = columns === 2 ? index % 2 : 0;
    const row = columns === 2 ? Math.floor(index / 2) : index;
    const x = pad + column * columnWidth;
    const lineY = y + row * rowGap;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `${Math.round(height * 0.024)}px sans-serif`;
    ctx.fillText(stat.label.slice(0, 34), x, lineY, columnWidth - 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(height * 0.042)}px sans-serif`;
    ctx.fillText(stat.value.slice(0, 26), x, lineY + Math.round(height * 0.037), columnWidth - 20);
  });

  if (options.note) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${Math.round(height * 0.024)}px sans-serif`;
    ctx.fillText(
      options.note.slice(0, 160),
      pad,
      height - Math.round(height * 0.24),
      width - pad * 2,
    );
  }

  const footerY = height - Math.round(height * 0.09);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `${Math.round(height * 0.021)}px sans-serif`;
  ctx.fillText(
    `Diterbitkan: ${shortDate(options.issuedAt)} UTC`,
    pad,
    footerY - Math.round(height * 0.075),
  );

  // Bottom-left: handwritten signature + printed name.
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.round(height * 0.115)}px EkaSignature, "Segoe Script", cursive`;
  ctx.fillText("Eka Ryan", pad, footerY + Math.round(height * 0.02), Math.round(width * 0.32));
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `${Math.round(height * 0.025)}px sans-serif`;
  ctx.fillText("Pt. Eka Ryan M.", pad, footerY + Math.round(height * 0.065));

  // Bottom-right: Code128 barcode pointing back to this website.
  const barcodeWidth = Math.round(width * 0.28);
  const barcodeHeight = Math.round(height * 0.075);
  drawBarcode(
    ctx,
    options.siteUrl ??
      (typeof window !== "undefined" ? window.location.origin : "https://artian.capital"),
    width - pad - barcodeWidth,
    footerY - Math.round(height * 0.02),
    barcodeWidth,
    barcodeHeight,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat PNG."))),
      "image/png",
    );
  });
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
