import { handler, ok, requireValue } from "@/server/api";
import { sql } from "@/server/pg";

/** Public feed of promos and trade ideas (images are external imgdb.io links). */
export const GET = handler(async () => {
  const rows = await sql`
    select p.id, p.user_id, u.username as author, u.role as author_role, p.kind, p.title, p.description,
           p.image_url, p.image_name, p.promo_code, p.code_enabled,
           p.url, p.url_enabled, p.created_at
    from promos p join users u on p.user_id = u.id
    order by p.created_at desc
  `;
  return ok({
    posts: rows.map(({ user_id, author_role, ...row }) => ({
      ...row,
      userId: user_id,
      authorRole: author_role ?? "member",
      kind: row.kind === "idea" ? "idea" : "promo",
      hasImage: Boolean(row.image_url),
    })),
  });
});

export const POST = handler(async () => {
  requireValue(false, "Gunakan /api/promos untuk membuat postingan.");
});
