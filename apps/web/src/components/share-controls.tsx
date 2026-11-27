"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";
import type { ShareSize } from "@/lib/share-image";

export interface ShareSettings {
  size: ShareSize;
  background: HTMLImageElement | HTMLVideoElement | null;
  error: string;
}

/** Background (still image or ≤15s video) and output size controls for PNG shares. */
export function ShareControls({
  value,
  onChange,
}: {
  value: ShareSettings;
  onChange: (next: ShareSettings) => void;
}) {
  const [videoTime, setVideoTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (value.background instanceof HTMLVideoElement) {
      videoRef.current = value.background;
      setDuration(value.background.duration || 0);
    } else {
      videoRef.current = null;
      setDuration(0);
      setVideoTime(0);
    }
  }, [value.background]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.src = URL.createObjectURL(file);
      try {
        await image.decode();
        onChange({ ...value, background: image, error: "" });
      } catch {
        onChange({ ...value, error: "Gambar tidak bisa dibaca." });
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
        await new Promise<void>((resolve, reject) => {
          if (video.readyState >= 1) {
            resolve();
            return;
          }
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("Video tidak bisa dibaca."));
        });
        if (video.duration > 15) {
          onChange({ ...value, error: "Video maksimal 15 detik." });
          return;
        }
        video.currentTime = 0;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          window.setTimeout(resolve, 1500);
        });
        setVideoTime(0);
        onChange({ ...value, background: video, error: "" });
      } catch (cause) {
        onChange({
          ...value,
          error: cause instanceof Error ? cause.message : "Video tidak bisa dibaca.",
        });
      }
      return;
    }
    onChange({ ...value, error: "Pilih gambar atau video." });
  };

  const seek = (time: number) => {
    setVideoTime(time);
    const video = videoRef.current;
    if (video) video.currentTime = time;
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Ukuran PNG</Label>
          <OptionSelect
            value={value.size}
            onValueChange={(size) => onChange({ ...value, size: size as ShareSize })}
          >
            <option value="1920x1080">1920 × 1080 (landscape)</option>
            <option value="1080x1080">1080 × 1080 (square)</option>
          </OptionSelect>
        </div>
        <div className="space-y-1">
          <Label>Background (gambar / video ≤15 detik)</Label>
          <input
            type="file"
            accept="image/*,video/*"
            className="text-xs"
            onChange={(event) => void pickFile(event.target.files?.[0])}
          />
        </div>
      </div>
      {duration > 0 && (
        <div className="space-y-1">
          <Label>Frame video (detik ke-{videoTime.toFixed(1)})</Label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={videoTime}
            onChange={(event) => seek(Number(event.target.value))}
            className="w-full"
          />
        </div>
      )}
      {value.error && <p className="text-xs text-destructive">{value.error}</p>}
      <p className="text-xs text-muted-foreground">
        Semua proses render berjalan di browser Anda — tidak ada gambar/video yang diunggah ke
        server.
      </p>
    </div>
  );
}
