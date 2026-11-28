import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { sql } from "@/server/pg";
import { canReadAllData } from "@/lib/roles";
import { deletePostCascade, deleteTradeCascade } from "@/server/cascade";
import { syncJournalsToLegacy } from "@/server/legacy-sync";
import { snapshotUser } from "@/server/snapshot";
import { runAsUser, db } from "@/db";
import { notes, playbooks, trades, progressRules, missedTrades } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nowIso } from "@/server/ids";

/** Pastikan pemanggil adalah owner atau admin. */
const privileged = async () => {
  const user = await currentUser();
  return Boolean(user && canReadAllData(user.role));
};

/**
 * DELETE /api/admin/member-delete
 * Body: { userId, resource, id? }
 *
 * resource:
 *   "trade"      → hapus 1 cfd_trade (id = uuid Supabase)
 *   "post"       → hapus 1 postingan + semua votes-nya
 *   "notebook"   → hapus 1 note dari SQLite user target
 *   "playbook"   → hapus 1 playbook dari SQLite user target
 *   "progress"   → archive 1 progress rule dari SQLite user target
 *   "missed"     → archive 1 missed trade dari SQLite user target
 *   "journal"    → hapus SEMUA trades + attachment user (tidak butuh id)
 *
 * Hanya owner/admin yang boleh memanggil endpoint ini.
 */
export const DELETE = handler(async (request: Request) => {
  if (!(await privileged())) return bad("Forbidden", 403);

  const body = (await request.json()) as {
    userId?: string;
    resource?: string;
    id?: string;
  };

  const { userId, resource, id } = body;
  requireValue(typeof userId === "string" && userId.trim(), "userId diperlukan.");
  requireValue(typeof resource === "string" && resource.trim(), "resource diperlukan.");

  // Verifikasi user target ada
  const target = await sql`select id from users where id = ${userId} limit 1`;
  requireValue(target.length > 0, "Member tidak ditemukan.");

  // Setelah mutation, sinkronkan cache SQLite & snapshot milik USER TARGET
  // (bukan admin yang sedang login). Tanpa ini dashboard menampilkan data hantu.
  const syncTarget = async (withJournal = false) =>
    runAsUser(userId!, async () => {
      if (withJournal) await syncJournalsToLegacy(userId!);
      await snapshotUser(userId!);
    });

  // --- Supabase-based resources ---
  if (resource === "trade") {
    requireValue(typeof id === "string" && id.trim(), "id trade diperlukan.");
    const result = await deleteTradeCascade(userId!, id!);
    await syncTarget(true);
    return ok(result);
  }

  if (resource === "post") {
    requireValue(typeof id === "string" && id.trim(), "id postingan diperlukan.");
    const post = await sql`select id from promos where id = ${id} and user_id = ${userId} limit 1`;
    requireValue(post.length > 0, "Postingan tidak ditemukan atau bukan milik user ini.");
    const result = await deletePostCascade(id!);
    await syncTarget();
    return ok(result);
  }

  if (resource === "journal") {
    // Hapus seluruh trades Supabase + attachment user
    const [imgResult, tradeResult] = await Promise.all([
      sql`delete from image_attachments where owner_id = ${userId}`,
      sql`delete from cfd_trades where owner_id = ${userId}`,
    ]);
    await syncTarget(true);
    return ok({
      trades: Number((tradeResult as unknown as { count?: number }).count ?? 0),
      images: Number((imgResult as unknown as { count?: number }).count ?? 0),
    });
  }

  // --- SQLite-based resources (notebook, playbook, progress, missed) ---
  // Jalankan query dalam konteks user target menggunakan runAsUser
  const today = nowIso().slice(0, 10);

  if (resource === "notebook") {
    requireValue(typeof id === "string" && id.trim(), "id note diperlukan.");
    const deleted = runAsUser(userId!, () => db.delete(notes).where(eq(notes.id, id!)).run());
    await syncTarget();
    return ok({ deleted: deleted.changes });
  }

  if (resource === "playbook") {
    requireValue(typeof id === "string" && id.trim(), "id playbook diperlukan.");
    runAsUser(userId!, () => {
      db.update(trades).set({ playbookId: null }).where(eq(trades.playbookId, id)).run();
      db.delete(playbooks).where(eq(playbooks.id, id)).run();
    });
    await syncTarget();
    return ok({ deleted: 1 });
  }

  if (resource === "progress") {
    requireValue(typeof id === "string" && id.trim(), "id progress rule diperlukan.");
    runAsUser(userId!, () =>
      db.update(progressRules).set({ archivedAt: today }).where(eq(progressRules.id, id)).run(),
    );
    await syncTarget();
    return ok({ archived: 1 });
  }

  if (resource === "missed") {
    requireValue(typeof id === "string" && id.trim(), "id missed trade diperlukan.");
    runAsUser(userId!, () =>
      db.update(missedTrades).set({ archivedAt: nowIso() }).where(eq(missedTrades.id, id)).run(),
    );
    await syncTarget();
    return ok({ archived: 1 });
  }

  return bad("Resource tidak dikenal: " + resource, 400);
});
