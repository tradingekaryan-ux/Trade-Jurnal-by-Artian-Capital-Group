import { handler, ok, requireValue } from "@/server/api";
import { currentUserId } from "@/db";
import { snapshotUser } from "@/server/snapshot";

/** Manual export of the local journal cache into Supabase. */
export const POST = handler(async () => {
  const userId = currentUserId();
  requireValue(Boolean(userId) && !userId.startsWith("__"), "Unauthorized.");
  await snapshotUser(userId!);
  return ok({ saved: true });
});
