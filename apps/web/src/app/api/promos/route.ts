import { and, eq } from "drizzle-orm";
import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import { uploadImage, MAX_IMAGE_BYTES } from "@/lib/imgdb";
import { canEditPromo, isUserRole } from "@/lib/roles";

const validUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const imageFilePresent = (form: FormData) => {
  const file = form.get("image");
  return file instanceof File && file.size > 0;
};

export const GET = handler(async () => {
  const rows = await sql`
    select p.id, p.user_id, u.username as author, p.kind, p.title, p.description,
           p.image_url, p.image_name, p.promo_code, p.code_enabled, p.url, p.url_enabled, p.created_at
    from promos p join users u on p.user_id = u.id
    order by p.created_at desc
  `;
  return ok({
    promos: rows.map(({ user_id, ...row }) => ({
      ...row,
      userId: user_id,
      author: row.author ?? "",
      hasImage: Boolean(row.image_url),
      codeEnabled: Boolean(row.code_enabled),
      urlEnabled: Boolean(row.url_enabled),
    })),
  });
});

export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  requireValue(
    Number(request.headers.get("content-length") ?? 0) <= MAX_IMAGE_BYTES + 20_000,
    "Gambar maksimal 16 MB.",
  );
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const promoCode = String(form.get("promoCode") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const kind = form.get("kind") === "idea" ? "idea" : "promo";
  const codeEnabled = form.get("codeEnabled") === "true";
  const urlEnabled = form.get("urlEnabled") === "true";
  requireValue(title.length >= 2 && title.length <= 160, "Judul harus 2–160 karakter.");
  requireValue(description.length <= 4000, "Deskripsi maksimal 4000 karakter.");
  requireValue(promoCode.length <= 200, "Promo code terlalu panjang.");
  requireValue(!url || validUrl(url), "URL harus http:// atau https://.");
  requireValue(!codeEnabled || promoCode.length > 0, "Isi promo code sebelum mengaktifkannya.");
  requireValue(!urlEnabled || url.length > 0, "Isi URL sebelum mengaktifkannya.");
  if (kind === "idea") requireValue(imageFilePresent(form), "Trade idea wajib gambar.");

  let imageUrl: string | null = null;
  let imageId: string | null = null;
  let imageName: string | null = null;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    requireValue(file.size <= MAX_IMAGE_BYTES, "Gambar maksimal 16 MB.");
    const uploaded = await uploadImage(Buffer.from(await file.arrayBuffer()), file.name);
    imageUrl = uploaded.url;
    imageId = uploaded.id;
    imageName = file.name.slice(0, 200);
  }

  const id = newId();
  const timestamp = nowIso();
  await sql`insert into promos
    (id, user_id, kind, title, description, image_url, image_id, image_name,
     promo_code, code_enabled, url, url_enabled, created_at, updated_at)
    values (${id}, ${user!.id}, ${kind}, ${title}, ${description}, ${imageUrl}, ${imageId}, ${imageName},
      ${promoCode || null}, ${codeEnabled}, ${url || null}, ${urlEnabled}, ${timestamp}, ${timestamp})`;
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
  const rows = await sql`select id, user_id from promos where id = ${body.id!} limit 1`;
  requireValue(rows.length > 0, "Promo tidak ditemukan.");
  const role = isUserRole(user!.role) ? user!.role : "member";
  requireValue(
    canEditPromo(role, rows[0]!.user_id, user!.id),
    "Anda hanya bisa mengelola promo sendiri.",
  );
  if (body.title !== undefined) {
    requireValue(body.title.trim().length >= 2 && body.title.length <= 160, "Judul tidak valid.");
    await sql`update promos set title = ${body.title.trim()}, updated_at = ${nowIso()} where id = ${body.id!}`;
  }
  if (body.description !== undefined)
    await sql`update promos set description = ${body.description.slice(0, 4000)}, updated_at = ${nowIso()} where id = ${body.id!}`;
  if (body.promoCode !== undefined)
    await sql`update promos set promo_code = ${body.promoCode.trim().slice(0, 200) || null}, updated_at = ${nowIso()} where id = ${body.id!}`;
  if (body.url !== undefined) {
    requireValue(!body.url || validUrl(body.url), "URL tidak valid.");
    await sql`update promos set url = ${body.url.trim() || null}, updated_at = ${nowIso()} where id = ${body.id!}`;
  }
  if (body.codeEnabled !== undefined)
    await sql`update promos set code_enabled = ${body.codeEnabled}, updated_at = ${nowIso()} where id = ${body.id!}`;
  if (body.urlEnabled !== undefined)
    await sql`update promos set url_enabled = ${body.urlEnabled}, updated_at = ${nowIso()} where id = ${body.id!}`;
  return ok({ updated: true });
});

export const DELETE = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const id = new URL(request.url).searchParams.get("id");
  requireValue(Boolean(id), "Promo id diperlukan.");
  const rows = await sql`select user_id from promos where id = ${id!} limit 1`;
  requireValue(rows.length > 0, "Promo tidak ditemukan.");
  const role = isUserRole(user!.role) ? user!.role : "member";
  requireValue(
    canEditPromo(role, rows[0]!.user_id, user!.id),
    "Anda hanya bisa menghapus promo sendiri.",
  );
  // Hapus voting lebih dulu, lalu postingan (FK cascade juga berlaku).
  await sql`delete from promo_votes where promo_id = ${id!}`;
  await sql`delete from promos where id = ${id!}`;
  return ok({ deleted: true, votesDeleted: true });
});
