import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { newId, nowIso } from "@/server/ids";
import { sql } from "@/server/pg";
import { uploadImage, MAX_IMAGE_BYTES } from "@/lib/imgdb";

/** Image bytes go to imgdb.io; only the permanent URL is stored in Supabase. */
export const GET = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "";
  const ref = params.get("id") ?? "";
  const rows = await sql`
    select id, name, url, created_at from image_attachments
    where owner_id = ${user!.id} and owner_type = ${type} and owner_ref = ${ref}
    order by created_at desc
  `;
  return ok({ attachments: rows });
});

export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  requireValue(
    Number(request.headers.get("content-length") ?? 0) <= MAX_IMAGE_BYTES + 20_000,
    "Gambar maksimal 16 MB.",
  );
  const form = await request.formData();
  const type = String(form.get("type") ?? "");
  const ref = String(form.get("id") ?? "");
  const file = form.get("file");
  requireValue(type && ref, "Owner tidak valid.");
  requireValue(
    file instanceof File && file.size > 0 && file.size <= MAX_IMAGE_BYTES,
    "Gambar maksimal 16 MB.",
  );
  const uploaded = await uploadImage(Buffer.from(await file.arrayBuffer()), file.name);
  const id = newId();
  await sql`insert into image_attachments (id, owner_id, owner_type, owner_ref, url, image_id, name, created_at)
    values (${id}, ${user!.id}, ${type}, ${ref}, ${uploaded.url}, ${uploaded.id}, ${file.name.slice(0, 200)}, ${nowIso()})`;
  return ok({ id, url: uploaded.url });
});
