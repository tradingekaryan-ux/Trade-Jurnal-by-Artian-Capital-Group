import { desc, eq } from "drizzle-orm";
import { systemDb } from "@/db";
import { promos, users } from "@/db/system-schema";
import { handler, ok, requireValue } from "@/server/api";
import type { Post } from "@/lib/posts";

/** Public feed of promos and trade ideas (metadata only; images via their own route). */
export const GET = handler(() => {
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
      kind: promos.kind,
      createdAt: promos.createdAt,
    })
    .from(promos)
    .innerJoin(users, eq(promos.userId, users.id))
    .orderBy(desc(promos.createdAt))
    .all();
  const posts: Post[] = rows.map(({ hasImage, ...row }) => ({
    ...row,
    kind: row.kind === "idea" ? "idea" : "promo",
    hasImage: Boolean(hasImage),
  }));
  return ok({ posts });
});

export const POST = handler(async (request: Request) => {
  requireValue(false, "Gunakan /api/promos atau /api/ideas untuk membuat postingan.");
});
