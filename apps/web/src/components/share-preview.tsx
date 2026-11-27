"use client";

/**
 * SharePreview — interactive canvas preview with:
 *   - pan (drag background image/video)
 *   - zoom (slider + mouse wheel)
 *   - works for both PnL/Post Shares and Certificate of Rank
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShareImageOptions } from "@/lib/share-image";
import { renderSharePng } from "@/lib/share-image";

export interface BgTransform {
  offsetX: number; // pixels (canvas space)
  offsetY: number;
  scale: number;   // 1 = fit, >1 zoom in
}

interface Props {
  /** Standard PnL/Post options (used when customRender is omitted). */
  options?: ShareImageOptions;
  /** Optional custom transparent-HUD renderer (used by Certificate of Rank). */
  customRender?: () => Promise<Blob>;
  /** Canvas dimensions override (defaults to options.size or 1920×1080). */
  dimensions?: [number, number];
  /** Background image/video element; transform applies to this element. */
  background: HTMLImageElement | HTMLVideoElement | null;
  transform: BgTransform;
  onTransformChange: (t: BgTransform) => void;
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
  onTransformChange,
  displayWidth = 760,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const [rendering, setRendering] = useState(false);

  const [w, h] =
    dimensions ??
    (options?.size === "1080x1080" ? [1080, 1080] : [1920, 1080]);
  const displayH = Math.round((displayWidth / w) * h);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderFn = customRender
      ? customRender
      : options
        ? () => renderSharePng({ ...options, background: null, transparentBackground: Boolean(background) })
        : null;
    if (!renderFn) return;
    setRendering(true);
    void drawPreview(canvas, renderFn, background, transform).finally(() => setRendering(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, customRender, background, transform]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!background) return;
      e.preventDefault();
      const delta = -e.deltaY / 500;
      const next = Math.min(5, Math.max(0.5, transform.scale + delta));
      onTransformChange({ ...transform, scale: next });
    },
    [background, transform, onTransformChange],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!background) return;
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: transform.offsetX, oy: transform.offsetY };
    },
    [background, transform],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStart.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const displayScale = canvas.width / displayWidth;
      const dx = (e.clientX - dragStart.current.mx) * displayScale;
      const dy = (e.clientY - dragStart.current.my) * displayScale;
      onTransformChange({
        ...transform,
        offsetX: dragStart.current.ox + dx,
        offsetY: dragStart.current.oy + dy,
      });
    },
    [transform, onTransformChange, displayWidth],
  );

  const onMouseUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  const touchStart = useRef<{ tx: number; ty: number; ox: number; oy: number } | null>(null);
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!background) return;
      const t = e.touches[0];
      if (!t) return;
      touchStart.current = { tx: t.clientX, ty: t.clientY, ox: transform.offsetX, oy: transform.offsetY };
    },
    [background, transform],
  );
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.touches[0];
      if (!t) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const displayScale = canvas.width / displayWidth;
      const dx = (t.clientX - touchStart.current.tx) * displayScale;
      const dy = (t.clientY - touchStart.current.ty) * displayScale;
      onTransformChange({
        ...transform,
        offsetX: touchStart.current.ox + dx,
        offsetY: touchStart.current.oy + dy,
      });
    },
    [transform, onTransformChange, displayWidth],
  );
  const onTouchEnd = useCallback(() => {
    touchStart.current = null;
  }, []);

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-lg border border-border bg-black select-none"
        style={{ width: displayWidth, height: displayH }}
      >
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          style={{
            width: displayWidth,
            height: displayH,
            cursor: background ? "grab" : "default",
            display: "block",
          }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-xs text-white/70">Rendering…</span>
          </div>
        )}
        {background && (
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/70">
            Drag to pan · scroll to zoom
          </div>
        )}
      </div>
    </div>
  );
}
