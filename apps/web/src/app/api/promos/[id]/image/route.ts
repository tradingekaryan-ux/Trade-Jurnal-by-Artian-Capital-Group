import { sql } from "@/server/pg";

type Context = { params: Promise<{ id: string }> };

/** Images are stored on imgdb.io; redirect to the permanent external URL. */
export const GET = async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const rows = await sql`select image_url from promos where id = ${id} limit 1`;
  const url = rows[0]?.image_url;
  if (!url) return new Response("Not found", { status: 404 });
  return Response.redirect(String(url), 302);
};
