import type { BgTransform } from "@/components/share-preview";

export interface VideoExportResult {
  blob: Blob;
  extension: "mp4" | "webm";
}

export const pickSupportedVideoMime = (): { mimeType: string; extension: "mp4" | "webm" } => {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "video/webm", extension: "webm" };
  }
  const candidates: Array<{ mimeType: string; extension: "mp4" | "webm" }> = [
    { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4" },
    { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: "video/webm", extension: "webm" };
};

const drawVideoFrame = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cW: number,
  cH: number,
  tf: BgTransform,
) => {
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  if (!sw || !sh) return;
  const base = Math.max(cW / sw, cH / sh);
  const fs = base * tf.scale;
  const dw = sw * fs;
  const dh = sh * fs;
  ctx.drawImage(video, (cW - dw) / 2 + tf.offsetX, (cH - dh) / 2 + tf.offsetY, dw, dh);
};

/**
 * Record a canvas compositing `video` background + `hudBlob` PNG overlay
 * using real-time playback and proper `rec.onstop` finalization so the
 * resulting MP4/WebM container is never truncated or corrupt.
 */
export const exportCanvasVideo = async (
  video: HTMLVideoElement,
  hudBlob: Blob,
  width: number,
  height: number,
  transform: BgTransform,
  startTime = 0,
): Promise<VideoExportResult> => {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung canvas.");

  const hudUrl = URL.createObjectURL(hudBlob);
  const hudImg = new Image();
  hudImg.src = hudUrl;
  await hudImg.decode();

  const { mimeType, extension } = pickSupportedVideoMime();
  const stream = offscreen.captureStream(30);
  const rec = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // Seek to start cleanly before recording
  video.pause();
  video.loop = false;
  video.muted = true;
  video.currentTime = Math.min(Math.max(0, startTime), Math.max(0, video.duration - 0.1));
  await new Promise<void>((res) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      res();
    };
    video.addEventListener("seeked", onSeeked);
    window.setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      res();
    }, 800);
  });

  // Draw initial frame before starting recorder
  ctx.clearRect(0, 0, width, height);
  drawVideoFrame(ctx, video, width, height, transform);
  ctx.drawImage(hudImg, 0, 0, width, height);

  try {
    await new Promise<void>((resolve, reject) => {
      let stopped = false;
      let rafId = 0;

      rec.onerror = () => {
        if (!stopped) {
          stopped = true;
          cancelAnimationFrame(rafId);
          reject(new Error("Gagal merekam video."));
        }
      };

      rec.onstop = () => {
        stopped = true;
        cancelAnimationFrame(rafId);
        resolve();
      };

      const finish = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(rafId);
        video.pause();
        // Allow MediaRecorder a brief moment to capture the final composited frame
        window.setTimeout(() => {
          if (rec.state !== "inactive") rec.stop();
        }, 120);
      };

      const onEnded = () => finish();
      video.addEventListener("ended", onEnded, { once: true });

      const renderLoop = () => {
        if (stopped) return;
        ctx.clearRect(0, 0, width, height);
        drawVideoFrame(ctx, video, width, height, transform);
        ctx.drawImage(hudImg, 0, 0, width, height);
        if (video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.03)) {
          finish();
          return;
        }
        rafId = requestAnimationFrame(renderLoop);
      };

      rec.start(250);
      void video
        .play()
        .then(() => {
          rafId = requestAnimationFrame(renderLoop);
        })
        .catch((err) => {
          video.removeEventListener("ended", onEnded);
          if (rec.state !== "inactive") rec.stop();
          reject(err instanceof Error ? err : new Error("Gagal memutar video."));
        });
    });
  } finally {
    URL.revokeObjectURL(hudUrl);
    stream.getTracks().forEach((t) => t.stop());
  }

  if (chunks.length === 0) {
    throw new Error("Hasil rekaman video kosong.");
  }

  return {
    blob: new Blob(chunks, { type: mimeType }),
    extension,
  };
};
