import { handler, ok, requireValue } from "@/server/api";
import { currentUserId } from "@/db";
import { syncJournalsToLegacy } from "@/server/legacy-sync";

/** Rebuild the local analytics cache from Supabase journal entries. */
export const POST = handler(async () => {
  const userId = currentUserId();
  requireValue(Boolean(userId) && !userId.startsWith("__"), "Unauthorized.");
  const synced = await syncJournalsToLegacy(userId!);
  return ok({ synced });
});
