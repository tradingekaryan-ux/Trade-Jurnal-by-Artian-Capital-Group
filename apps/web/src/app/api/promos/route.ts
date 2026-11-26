import { and, desc, eq } from "drizzle-orm";
import { systemDb } from "@/db";
import { promos, users } from "@/db/system-schema";
import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { attachmentMime, MAX_ATTACHMENT_SIZE } from "@/lib/attachment-validation";
import { canEditPromo, isUserRole } from "@/lib/roles";

const validUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const GET = handler(async () => {
  const rows = systemDb
    .select({
      id: promos.id,
      userId: promos.userId,
      author: users.username,
      title: promos.title,
      description: promos.description,
      imageMime: promos.imageMime,
      imageName: promos.imageName,
      hasImage: promos.imageData,
      promoCode: promos.promoCode,
      codeEnabled: promos.codeEnabled,
      url: promos.url,
      urlEnabled: promos.urlEnabled,
      createdAt: promos.createdAt,
    })
    .from(promos)
    .innerJoin(users, eq(promos.userId, users.id))
    .orderBy(desc(promos.createdAt))
    .all();
  return ok({
    promos: rows.map(({ hasImage, ...row }) => ({ ...row, hasImage: Boolean(hasImage) })),
  });
});

export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  requireValue(
    Number(request.headers.get("content-length") ?? 0) <= MAX_ATTACHMENT_SIZE + 20_000,
    "Gambar maksimal 8 MB.",
  );
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const promoCode = String(form.get("promoCode") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const codeEnabled = form.get("codeEnabled") === "true";
  const urlEnabled = form.get("urlEnabled") === "true";
  requireValue(title.length >= 2 && title.length <= 160, "Judul harus 2–160 karakter.");
  requireValue(description.length <= 4000, "Deskripsi maksimal 4000 karakter.");
  requireValue(promoCode.length <= 200, "Promo code terlalu panjang.");
  requireValue(!url || validUrl(url), "URL harus http:// atau https://.");
  requireValue(!codeEnabled || promoCode.length > 0, "Isi promo code sebelum mengaktifkannya.");
  requireValue(!urlEnabled || url.length > 0, "Isi URL sebelum mengaktifkannya.");

  const file = form.get("image");
  let imageData: Buffer | null = null;
  let imageMime: string | null = null;
  let imageName: string | null = null;
  if (file instanceof File && file.size > 0) {
    requireValue(file.size <= MAX_ATTACHMENT_SIZE, "Gambar maksimal 8 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    imageMime = attachmentMime(bytes);
    requireValue(imageMime?.startsWith("image/"), "Format gambar harus PNG, JPEG, atau WebP.");
    imageData = bytes;
    imageName = file.name.slice(0, 200);
  }

  const id = newId();
  const timestamp = nowIso();
  systemDb
    .insert(promos)
    .values({
      id,
      userId: user!.id,
      title,
      description,
      imageData,
      imageMime,
      imageName,
      promoCode: promoCode || null,
      codeEnabled,
      url: url || null,
      urlEnabled,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();
  return ok({ id }, { status: 201 });
});

export const PATCH = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    description?: string;
    promoCode?: string;
    url?: string;
    codeEnabled?: boolean;
    urlEnabled?: boolean;
  };
  requireValue(typeof body.id === "string", "Promo id diperlukan.");
  const row = systemDb.select().from(promos).where(eq(promos.id, body.id!)).get();
  requireValue(Boolean(row), "Promo tidak ditemukan.");
  const role = isUserRole(user!.role) ? user!.role : "member";
  requireValue(
    canEditPromo(role, row!.userId, user!.id),
    "Anda hanya bisa mengelola promo milik sendiri.",
  );
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (body.title !== undefined) {
    requireValue(body.title.trim().length >= 2 && body.title.length <= 160, "Judul tidak valid.");
    patch.title = body.title.trim();
  }
  if (body.description !== undefined) patch.description = body.description.slice(0, 4000);
  if (body.promoCode !== undefined) patch.promoCode = body.promoCode.trim().slice(0, 200) || null;
  if (body.url !== undefined) {
    requireValue(!body.url || validUrl(body.url), "URL tidak valid.");
    patch.url = body.url.trim() || null;
  }
  if (body.codeEnabled !== undefined) patch.codeEnabled = body.codeEnabled;
  if (body.urlEnabled !== undefined) patch.urlEnabled = body.urlEnabled;
  systemDb
    .update(promos)
    .set(patch)
    .where(and(eq(promos.id, body.id!), eq(promos.userId, row!.userId)))
    .run();
  return ok({ updated: true });
});

export const DELETE = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const id = new URL(request.url).searchParams.get("id");
  requireValue(Boolean(id), "Promo id diperlukan.");
  const row = systemDb.select().from(promos).where(eq(promos.id, id!)).get();
  requireValue(Boolean(row), "Promo tidak ditemukan.");
  const role = isUserRole(user!.role) ? user!.role : "member";
  requireValue(
    canEditPromo(role, row!.userId, user!.id),
    "Anda hanya bisa menghapus promo milik sendiri.",
  );
  systemDb.delete(promos).where(eq(promos.id, id!)).run();
  return ok({ deleted: true });
});
