"use client";

/**
 * SharePreview — read-only canvas preview.
 * Background positioning is done exclusively through the console control panel,
 * never by dragging/scrolling on the preview itself.
 */

import { useEffect, useRef, useState } from "react";
import type { ShareImageOptions } from "@/lib/share-image";
import { renderSharePng } from "@/lib/share-image";

export interface BgTransform {
  offsetX: number; // pixels (canvas space)
  offsetY: number;
  scale: number; // 1 = fit, >1 zoom in
}

interface Props {
  /** Standard PnL/Post options (used when customRender is omitted). */
  options?: ShareImageOptions;
  /** Optional custom transparent-HUD renderer (used by Certificate of Rank). */
  customRender?: () => Promise<Blob>;
  /** Canvas dimensions override (defaults to options.size or 1920×1080). */
  dimensions?: [number, number];
  /** Background image/video element. */
  background: HTMLImageElement | HTMLVideoElement | null;
  transform: BgTransform;
  /** Preview display width in CSS pixels (height auto from aspect ratio). */
  displayWidth?: number;
}

const drawPreview = async (
  canvas: HTMLCanvasElement,
  renderOverlay: () => Promise<Blob>,
  bg: HTMLImageElement | HTMLVideoElement | null,
  transform: BgTransform,
): Promise<void> => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);

  if (bg) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    const sw = bg instanceof HTMLVideoElement ? bg.videoWidth : bg.naturalWidth;
    const sh = bg instanceof HTMLVideoElement ? bg.videoHeight : bg.naturalHeight;
    if (sw && sh) {
      const baseScale = Math.max(W / sw, H / sh);
      const finalScale = baseScale * transform.scale;
      const dw = sw * finalScale;
      const dh = sh * finalScale;
      const dx = (W - dw) / 2 + transform.offsetX;
      const dy = (H - dh) / 2 + transform.offsetY;
      ctx.drawImage(bg, dx, dy, dw, dh);
    }
  }

  try {
    const blob = await renderOverlay();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    ctx.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(img.src);
  } catch {
    // ignore preview render errors
  }
};

export function SharePreview({
  options,
  customRender,
  dimensions,
  background,
  transform,
  displayWidth = 760,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);

  const [w, h] = dimensions ?? (options?.size === "1080x1080" ? [1080, 1080] : [1920, 1080]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderFn = customRender
      ? customRender
      : options
        ? () =>
            renderSharePng({
              ...options,
              background: null,
              transparentBackground: Boolean(background),
            })
        : null;
    if (!renderFn) return;
    setRendering(true);
    void drawPreview(canvas, renderFn, background, transform).finally(() => setRendering(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, customRender, background, transform]);

  return (
    <div className="space-y-2">
      <div className="relative w-full min-w-0 overflow-hidden rounded-lg border border-border bg-black select-none">
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          className="block h-auto w-full"
          style={{ maxWidth: displayWidth, aspectRatio: `${w} / ${h}` }}
        />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-xs text-white/70">Rendering…</span>
          </div>
        )}
      </div>
    </div>
  );
}
