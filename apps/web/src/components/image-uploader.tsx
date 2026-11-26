"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImageMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
}

/** Optional image attachment picker for journal entries and trades. */
export function ImageUploader({
  type,
  id,
  label = "Gambar (opsional)",
}: {
  type: "cfd-trade" | "trade";
  id?: string | null;
  label?: string;
}) {
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    if (!id) {
      setImages([]);
      return;
    }
    fetch(`/api/attachments?type=${type}&id=${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { attachments: ImageMeta[] }) => setImages(body.attachments))
      .catch(() => setImages([]));
  };
  useEffect(load, [id, type]);

  const upload = async (files: FileList | null) => {
    if (!id || !files?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("type", type);
        form.set("id", id);
        form.set("file", file);
        const response = await fetch("/api/attachments", { method: "POST", body: form });
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error ?? "Gagal mengunggah gambar.");
        }
      }
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengunggah gambar.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (imageId: string) => {
    await fetch(`/api/attachments/${encodeURIComponent(imageId)}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={!id || busy}
        onChange={(event) => void upload(event.target.files)}
      />
      {!id && (
        <p className="text-xs text-muted-foreground">
          Simpan entri terlebih dahulu, lalu tambahkan gambar.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative">
              <img
                src={`/api/attachments/${encodeURIComponent(image.id)}`}
                alt={image.name}
                className="h-20 w-20 rounded-md border object-cover"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute -right-1 -top-1 h-5 w-5 p-0"
                onClick={() => void remove(image.id)}
                aria-label={`Hapus ${image.name}`}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
