import { attachmentMime } from "./attachment-validation";

const UPLOAD_URL = "https://imgdb.io/api/v1/upload";
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

interface UploadResult {
  url: string;
  id: string;
  type: string;
  size: number;
}

/** Upload one image to imgdb.io and return the permanent direct link. */
export async function uploadImage(bytes: Uint8Array, name: string): Promise<UploadResult> {
  const mime = attachmentMime(bytes);
  if (!mime?.startsWith("image/"))
    throw new Error("Format gambar harus PNG, JPEG, WebP, GIF, AVIF, atau BMP.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Gambar maksimal 16 MB.");
  const form = new FormData();
  form.set(
    "file",
    new Blob([bytes as BlobPart], { type: mime }),
    name.slice(0, 200) || "image.png",
  );
  form.set("ttl", "0"); // never expires
  const response = await fetch(UPLOAD_URL, { method: "POST", body: form });
  const body = (await response.json()) as UploadResult & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Gagal mengunggah gambar ke imgdb.io.");
  return body;
}
