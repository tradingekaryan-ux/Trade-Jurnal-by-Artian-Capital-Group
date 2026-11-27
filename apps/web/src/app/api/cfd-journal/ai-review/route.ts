import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { sql } from "@/server/pg";
import { getAiModel } from "@/server/settings";
import { getPlaybookRules } from "@/server/ai-context";
import { pickVisionModel, runAi, runAiWithImages, type AiImage } from "@/server/ai";

export const runtime = "nodejs";

/** AI review for one Supabase-native journal trade, optionally with its chart screenshots. */
export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  requireValue(Boolean(user), "Unauthorized.");
  const body = (await request.json()) as { id?: string };
  requireValue(typeof body.id === "string" && body.id.length > 0, "Trade id diperlukan.");
  const found =
    await sql`select * from cfd_trades where id = ${body.id!} and owner_id = ${user!.id} limit 1`;
  requireValue(found.length > 0, "Trade tidak ditemukan.");
  const row = found[0]!;

  const attachments = await sql`select url from image_attachments
    where owner_id = ${user!.id} and owner_type = 'cfd-trade' and owner_ref = ${body.id!}
    order by created_at limit 3`;
  const preferred = await getAiModel();
  const visionModel = attachments.length > 0 ? await pickVisionModel(preferred) : null;
  const usedModel = visionModel ?? preferred;
  const images: AiImage[] = [];
  for (const attachment of attachments) {
    try {
      const response = await fetch(String(attachment.url), {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) continue;
      const mime = response.headers.get("content-type") ?? "image/png";
      if (!mime.startsWith("image/")) continue;
      images.push({
        data: Buffer.from(await response.arrayBuffer()).toString("base64"),
        mediaType: mime,
      });
    } catch {
      // An unreachable image must not block the text review.
    }
  }
  const sendImages = visionModel !== null && images.length > 0;
  const rules = await getPlaybookRules(user!.id);
  const prompt = `Review trade jurnal ini dalam Bahasa Indonesia, maksimal 180 kata.
- Simbol: ${row.symbol} (${row.mode}), side ${row.side}, lot/size ${row.lot}
- Entry ${row.entry}, exit ${row.exit_price ?? "-"}, SL ${row.stop_loss ?? "-"}, TP ${row.take_profit ?? "-"}
- Hasil: ${row.status}, pips ${row.pips ?? "n/a"}, P&L ${row.pnl ?? 0}, R ${row.r_multiple ?? "n/a"}, RR ${row.risk_reward ?? "n/a"}
- Catatan trader: ${row.notes || "-"}
- Aturan playbook: ${rules || "tidak ada"}
${sendImages ? "- Screenshot chart terlampir. Analisis harga, area entry/SL/TP, dan apakah eksekusi konsisten.\n" : ""}
Berikan: (1) penilaian eksekusi, (2) penilaian risiko (SL dipatuhi? RR masuk akal?), (3) satu instruksi konkret. Jangan mengarang data yang tidak tersedia.`;

  const review = sendImages
    ? await runAiWithImages(prompt, images, 1200, usedModel)
    : await runAi(prompt, 1200, usedModel);
  return ok({ review, model: usedModel, imagesUsed: images.length });
});
