"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "./ui/button";
import type { BgTransform } from "./share-preview";

/** D-pad + zoom controls for positioning a share/certificate background. */
export function BackgroundControls({
  transform,
  onChange,
  disabled = false,
  step = 48,
  zoomStep = 0.15,
}: {
  transform: BgTransform;
  onChange: (next: BgTransform) => void;
  disabled?: boolean;
  /** Canvas pixels moved per arrow press. */
  step?: number;
  zoomStep?: number;
}) {
  const nudge = (dx: number, dy: number) =>
    onChange({ ...transform, offsetX: transform.offsetX + dx, offsetY: transform.offsetY + dy });

  const zoom = (factor: number) =>
    onChange({
      ...transform,
      scale: Math.min(5, Math.max(0.5, Number((transform.scale * factor).toFixed(3)))),
    });

  const reset = () => onChange({ offsetX: 0, offsetY: 0, scale: 1 });
  const iconBtn = "h-8 w-8 sm:h-9 sm:w-9";

  return (
    <div className="flex flex-wrap items-end gap-4 sm:gap-6">
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Posisi background
        </p>
        <div className="grid w-fit grid-cols-3 gap-1">
          <span />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={iconBtn}
            disabled={disabled}
            aria-label="Geser background ke atas"
            title="Atas"
            onClick={() => nudge(0, -step)}
          >
            <ArrowUp />
          </Button>
          <span />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={iconBtn}
            disabled={disabled}
            aria-label="Geser background ke kiri"
            title="Kiri"
            onClick={() => nudge(-step, 0)}
          >
            <ArrowLeft />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={iconBtn}
            disabled={disabled}
            aria-label="Reset posisi background"
            title="Reset posisi"
            onClick={reset}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={iconBtn}
            disabled={disabled}
            aria-label="Geser background ke kanan"
            title="Kanan"
            onClick={() => nudge(step, 0)}
          >
            <ArrowRight />
          </Button>
          <span />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={iconBtn}
            disabled={disabled}
            aria-label="Geser background ke bawah"
            title="Bawah"
            onClick={() => nudge(0, step)}
          >
            <ArrowDown />
          </Button>
          <span />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Zoom · {Math.round(transform.scale * 100)}%
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={iconBtn}
            disabled={disabled || transform.scale <= 0.5}
            aria-label="Zoom out background"
            title="Zoom out"
            onClick={() => zoom(1 / (1 + zoomStep))}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={iconBtn}
            disabled={disabled || transform.scale >= 5}
            aria-label="Zoom in background"
            title="Zoom in"
            onClick={() => zoom(1 + zoomStep)}
          >
            <ZoomIn />
          </Button>
        </div>
      </div>
    </div>
  );
}
