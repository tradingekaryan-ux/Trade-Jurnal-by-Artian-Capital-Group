import { eq } from "drizzle-orm";
import { systemDb } from "@/db";
import { promos } from "@/db/system-schema";
import { bad } from "@/server/api";

type Context = { params: Promise<{ id: string }> };

export const GET = async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const row = systemDb.select().from(promos).where(eq(promos.id, id)).get();
  if (!row?.imageData || !row.imageMime) return bad("Image not found", 404);
  return new Response(new Uint8Array(row.imageData), {
    headers: {
      "Content-Type": row.imageMime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
};
