import { eq } from "drizzle-orm";
import { db, systemDb } from "@/db";
import { accounts } from "@/db/schema";
import { models } from "@/db/system-schema";
import { rebuildAccount } from "@/server/rebuild";
import { handler, ok, requireValue } from "@/server/api";
import {
  getCurrencyConversion,
  getImportTimeZone,
  getMultipliers,
  getTimeZone,
  getAiSettings,
  isPaidAllowed,
  setAiKey,
  setAiModel,
  setSetting,
} from "@/server/settings";
import { isTimeZone } from "@/lib/timezone";
import { parseCurrencyConversion, type CurrencyConversion } from "@/lib/currencies";

export const GET = handler(() =>
  ok({
    timeZone: getTimeZone(),
    importTimeZone: getImportTimeZone(),
    multipliers: getMultipliers(),
    currencyConversion: getCurrencyConversion(),
    ...getAiSettings(),
  }),
);

interface SettingsBody {
  timeZone?: string;
  importTimeZone?: string;
  multipliers?: Record<string, number>;
  aiModel?: string;
  /** Key string to store encrypted, null to clear, absent to keep unchanged. */
  openrouterKey?: string | null;
  currencyConversion?: CurrencyConversion;
}

export const PATCH = handler(async (request: Request) => {
  const body = (await request.json()) as SettingsBody;
  requireValue(body && typeof body === "object" && !Array.isArray(body), "Enter valid settings.");

  let conversion: CurrencyConversion | undefined;
  if (body.currencyConversion !== undefined) {
    try {
      conversion = parseCurrencyConversion(body.currencyConversion);
    } catch (error) {
      requireValue(false, error instanceof Error ? error.message : "Enter valid conversion rates.");
    }
    if (conversion.enabled) {
      const missing = [
        ...new Set(
          db
            .select({ currency: accounts.currency })
            .from(accounts)
            .all()
            .map((a) => a.currency),
        ),
      ].filter(
        (currency) => currency !== conversion!.reportingCurrency && !conversion!.rates[currency],
      );
      requireValue(
        missing.length === 0,
        `Enter conversion rates for ${missing.join(", ")} before enabling conversion.`,
      );
    }
  }

  if (body.aiModel !== undefined) {
    requireValue(
      typeof body.aiModel === "string" &&
        /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(body.aiModel.trim()),
      "Enter a valid OpenRouter model ID.",
    );
    const model = systemDb.select().from(models).where(eq(models.id, body.aiModel.trim())).get();
    const ownKey = body.openrouterKey !== undefined ? Boolean(body.openrouterKey) : undefined;
    requireValue(
      model?.tier !== "paid" || isPaidAllowed() || Boolean(ownKey),
      "Model berbayar tidak diizinkan. Pilih model Free atau tambahkan kunci OpenRouter Anda.",
    );
  }

  if (body.openrouterKey !== undefined) {
    requireValue(
      body.openrouterKey === null ||
        (typeof body.openrouterKey === "string" &&
          body.openrouterKey.trim().length > 0 &&
          body.openrouterKey.length <= 4096 &&
          !/\s/.test(body.openrouterKey.trim())),
      "Enter a valid OpenRouter API key.",
    );
  }

  for (const key of ["timeZone", "importTimeZone"] as const)
    if (body[key] !== undefined)
      requireValue(isTimeZone(body[key]), `Enter a valid IANA ${key} timezone.`);

  if (body.multipliers !== undefined)
    requireValue(
      body.multipliers &&
        typeof body.multipliers === "object" &&
        Object.values(body.multipliers).every(
          (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
        ),
      "Contract multipliers must be positive numbers.",
    );

  db.transaction(() => {
    if (conversion) setSetting("currencyConversion", JSON.stringify(conversion));
    if (body.timeZone !== undefined || body.importTimeZone !== undefined)
      setSetting("importTimeZone", body.importTimeZone ?? getImportTimeZone());
    if (body.timeZone !== undefined) setSetting("timeZone", body.timeZone);
  });
  if (body.multipliers !== undefined)
    db.transaction(() => {
      setSetting("multipliers", JSON.stringify(body.multipliers));
      for (const account of db.select({ id: accounts.id }).from(accounts).all())
        rebuildAccount(account.id);
    });
  db.transaction(() => {
    if (body.aiModel !== undefined) setAiModel(body.aiModel.trim());
    if (body.openrouterKey !== undefined) setAiKey(body.openrouterKey);
  });
  return ok({ saved: true });
});
