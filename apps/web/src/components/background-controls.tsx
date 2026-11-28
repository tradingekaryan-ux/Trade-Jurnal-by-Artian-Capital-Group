"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Minus,
  Plus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { BgTransform } from "./share-preview";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Single console-style panel for positioning, zooming and fading the background. */
export function BackgroundControls({
  transform,
  onChange,
  opacity,
  onOpacityChange,
  disabled = false,
  step = 48,
  zoomStep = 0.15,
  opacityStep = 5,
}: {
  transform: BgTransform;
  onChange: (next: BgTransform) => void;
  /** 0–1 (0% = no extra overlay). */
  opacity: number;
  onOpacityChange: (next: number) => void;
  disabled?: boolean;
  step?: number;
  zoomStep?: number;
  opacityStep?: number;
}) {
  const percent = Math.round(opacity * 100);
  const nudge = (dx: number, dy: number) =>
    onChange({
      ...transform,
      offsetX: Math.round(transform.offsetX + dx),
      offsetY: Math.round(transform.offsetY + dy),
    });
  const zoom = (factor: number) =>
    onChange({
      ...transform,
      scale: Number(clamp(transform.scale * factor, 0.5, 5).toFixed(3)),
    });
  const setPercent = (next: number) => onOpacityChange(clamp(next, 0, 100) / 100);
  const reset = () => {
    onChange({ offsetX: 0, offsetY: 0, scale: 1 });
    setPercent(0);
  };
  const screen = `X ${transform.offsetX >= 0 ? "+" : ""}${transform.offsetX}  Y ${
    transform.offsetY >= 0 ? "+" : ""
  }${transform.offsetY}  Z ${Math.round(transform.scale * 100)}%  OP ${percent}%`;

  return (
    <div className="edit-console">
      <div className="edit-console-head">
        <span className="edit-console-led" data-on={!disabled} />
        <span>BACKGROUND CONTROL</span>
        <span className="edit-console-head-right">ED·01 / OFFLINE</span>
      </div>

      <div className="edit-console-screen" aria-label="Posisi background saat ini">
        {screen}
      </div>

      <div className="edit-console-grid">
        <section className="edit-console-section">
          <p className="edit-console-label">POSITION · {step}px</p>
          <div className="edit-console-dpad">
            <span />
            <button
              className="edit-key"
              disabled={disabled}
              onClick={() => nudge(0, -step)}
              aria-label="Geser background ke atas"
              title="Atas"
            >
              <ArrowUp />
            </button>
            <span />
            <button
              className="edit-key"
              disabled={disabled}
              onClick={() => nudge(-step, 0)}
              aria-label="Geser background ke kiri"
              title="Kiri"
            >
              <ArrowLeft />
            </button>
            <button
              className="edit-key"
              disabled={disabled}
              onClick={reset}
              aria-label="Reset posisi dan opacity"
              title="Reset"
            >
              <RotateCcw />
            </button>
            <button
              className="edit-key"
              disabled={disabled}
              onClick={() => nudge(step, 0)}
              aria-label="Geser background ke kanan"
              title="Kanan"
            >
              <ArrowRight />
            </button>
            <span />
            <button
              className="edit-key"
              disabled={disabled}
              onClick={() => nudge(0, step)}
              aria-label="Geser background ke bawah"
              title="Bawah"
            >
              <ArrowDown />
            </button>
            <span />
          </div>
        </section>

        <section className="edit-console-section">
          <p className="edit-console-label">ZOOM · {Math.round(transform.scale * 100)}%</p>
          <div className="edit-console-row">
            <button
              className="edit-key edit-key-wide"
              disabled={disabled || transform.scale <= 0.5}
              onClick={() => zoom(1 / (1 + zoomStep))}
              aria-label="Zoom out background"
              title="Zoom out"
            >
              <ZoomOut /> <span>−</span>
            </button>
            <button
              className="edit-key edit-key-wide"
              disabled={disabled || transform.scale >= 5}
              onClick={() => zoom(1 + zoomStep)}
              aria-label="Zoom in background"
              title="Zoom in"
            >
              <ZoomIn /> <span>+</span>
            </button>
          </div>
          <p className="edit-console-hint">Perbesar / perkecil gambar.</p>
        </section>

        <section className="edit-console-section">
          <p className="edit-console-label">OVERLAY OPACITY</p>
          <div className="edit-console-row">
            <button
              className="edit-key"
              onClick={() => setPercent(percent - opacityStep)}
              aria-label="Turunkan opacity"
              title="Turunkan"
            >
              <Minus />
            </button>
            <label className="edit-console-input">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={percent}
                onChange={(event) => setPercent(Number(event.target.value))}
                aria-label="Opacity overlay dalam persen"
              />
              <span>%</span>
            </label>
            <button
              className="edit-key"
              onClick={() => setPercent(percent + opacityStep)}
              aria-label="Naikkan opacity"
              title="Naikkan"
            >
              <Plus />
            </button>
          </div>
          <p className="edit-console-hint">0% = background tanpa overlay tambahan.</p>
        </section>
      </div>
    </div>
  );
}
