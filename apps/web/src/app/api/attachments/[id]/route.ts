import { handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { sql } from "@/server/pg";

type Context = { params: Promise<{ id: string }> };

export const GET = async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const rows = await sql`select url from image_attachments where id = ${id} limit 1`;
  if (!rows[0]?.url) return new Response("Not found", { status: 404 });
  return Response.redirect(String(rows[0].url), 302);
};

export const DELETE = handler(async (_request: Request, { params }: Context) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const { id } = await params;
  await sql`delete from image_attachments where id = ${id} and owner_id = ${user!.id}`;
  return ok({ deleted: true });
});
