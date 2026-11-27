import { handler, ok } from "@/server/api";
import { getGlobalSetting } from "@/server/settings";
import { DEFAULT_QUOTES } from "@/lib/quotes";

/** Public quotes feed for the dashboard slideshow. */
export const GET = handler(
  async () => {
    let quotes = DEFAULT_QUOTES;
    try {
      const raw = await getGlobalSetting("dashboardQuotes");
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((item) => typeof item === "string" && item.trim().length > 0)
        )
          quotes = parsed.map((item) => item.trim().slice(0, 200));
      }
    } catch {
      // Fall back to the built-in quotes.
    }
    return ok({ quotes, intervalMs: 3000 });
  },
  { public: true },
);
