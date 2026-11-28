import { handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { sql } from "@/server/pg";
import { runAi } from "@/server/ai";

/** Community assistant: idea consensus summary and promo risk flags. */
export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const body = (await request.json()) as { kind?: string };
  requireValue(body.kind === "idea" || body.kind === "promo", "Jenis tidak valid.");

  if (body.kind === "idea") {
    const rows = await sql`select p.id, p.title, p.description, u.username as author,
        count(v.id) filter (where v.value = 'take_profit')::int as tp,
        count(v.id) filter (where v.value = 'stop_loss')::int as sl
      from promos p join users u on u.id = p.user_id
      left join promo_votes v on v.promo_id = p.id
      where p.kind = 'idea'
      group by p.id, p.title, p.description, u.username
      order by count(v.id) desc limit 20`;
    const lines = rows.map((row) => {
      const total = Number(row.tp) + Number(row.sl);
      const pct = total ? Math.round((Number(row.tp) / total) * 100) : 0;
      return `${row.title} oleh @${row.author}: TP ${row.tp} (${pct}%), SL ${row.sl} (${100 - pct}%). Deskripsi: ${String(row.description).slice(0, 200)}`;
    });
    requireValue(lines.length > 0, "Belum ada trade idea.");
    const text = await runAi(
      `Rangkum konsensus komunitas pada trade idea berikut dalam Bahasa Indonesia, maksimal 180 kata.
${lines.join("\n")}
Sebutkan idea dengan dukungan Take Profit tertinggi, yang paling kontroversial, dan satu hal yang harus dicek sebelum mengikuti ide tersebut. Jangan memberi rekomendasi investasi.`,
      2000,
    );
    return ok({ text });
  }

  const rows =
    await sql`select p.id, p.title, p.description, p.promo_code, p.url, u.username as author
    from promos p join users u on u.id = p.user_id
    where p.kind = 'promo' order by p.created_at desc limit 30`;
  requireValue(rows.length > 0, "Belum ada promo.");
  const lines = rows.map(
    (row) =>
      `@${row.author} | ${row.title} | code ${row.promo_code || "-"} | URL ${row.url || "-"} | ${String(row.description).slice(0, 160)}`,
  );
  const text = await runAi(
    `Periksa daftar promo komunitas berikut. Tandai secara ringkas (maks. 180 kata, Bahasa Indonesia) entri yang berisiko: URL bukan https, shortener mencurigakan, janji hasil tidak realistis, kode/deskripsi tidak konsisten, atau tautan yang tidak sesuai judul. Sebutkan ID bagian dari baris yang bermasalah dan alasannya. Jangan menyimpulkan hal yang tidak terlihat dari teks.

${lines.join("\n")}`,
    2000,
  );
  return ok({ text });
});
