import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { GLOBAL_KEY_SLOTS, getGlobalKeyOverview, setGlobalKey } from "@/server/settings";
import { canManageSite } from "@/lib/roles";

/** Owner-only: manage the 10 encrypted OpenRouter fallback keys in Supabase. */
const ownerOnly = async () => {
  const user = await currentUser();
  return Boolean(user && canManageSite(user.role));
};

export const GET = handler(async () => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  return ok({ slots: await getGlobalKeyOverview() });
});

export const POST = handler(async (request: Request) => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as { action?: string; slot?: number; key?: string };
  requireValue(body.action === "set" || body.action === "clear", "Aksi tidak valid.");
  requireValue(
    Number.isInteger(body.slot) && Number(body.slot) >= 1 && Number(body.slot) <= GLOBAL_KEY_SLOTS,
    `Slot harus 1–${GLOBAL_KEY_SLOTS}.`,
  );
  const slot = Number(body.slot);
  if (body.action === "clear") {
    await setGlobalKey(slot, null);
    return ok({ cleared: slot });
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  requireValue(key.length >= 8 && key.length <= 500, "Kunci OpenRouter harus 8–500 karakter.");
  requireValue(!/\s/.test(key), "Kunci OpenRouter tidak boleh mengandung spasi.");
  await setGlobalKey(slot, key);
  return ok({ saved: slot });
});
