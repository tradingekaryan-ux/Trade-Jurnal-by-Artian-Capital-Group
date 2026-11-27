import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { setGlobalSetting } from "@/server/settings";
import { canManageSite } from "@/lib/roles";

/** Owner-only customization of the dashboard quote slideshow. */
export const POST = handler(async (request: Request) => {
  const user = await currentUser();
  if (!user || !canManageSite(user.role)) return bad("Forbidden", 403);
  const body = (await request.json()) as { quotes?: unknown };
  requireValue(Array.isArray(body.quotes), "Daftar quote harus berupa array.");
  const quotes = (body.quotes as unknown[]).map((value) =>
    typeof value === "string" ? value.trim().slice(0, 200) : "",
  );
  requireValue(quotes.length >= 1 && quotes.length <= 50, "Isi 1–50 quote.");
  requireValue(
    quotes.every((quote) => quote.length > 0),
    "Quote tidak boleh kosong.",
  );
  await setGlobalSetting("dashboardQuotes", JSON.stringify(quotes));
  return ok({ saved: quotes.length });
});
