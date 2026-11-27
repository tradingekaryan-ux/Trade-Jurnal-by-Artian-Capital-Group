import { handler, ok } from "@/server/api";
import { getGlobalSetting } from "@/server/settings";

/** Endpoint publik (tidak butuh auth) — hanya mengembalikan URL Discord yang
 *  dikonfigurasi owner, digunakan FloatingDiscord agar tidak ter-cache layout. */
export const dynamic = "force-dynamic";

const DEFAULT = process.env.NEXT_PUBLIC_DISCORD_URL?.trim() || "https://discord.com/";

export const GET = handler(async () => {
  let url = DEFAULT;
  let enabled = true;
  try {
    const [savedUrl, savedEnabled] = await Promise.all([
      getGlobalSetting("discordUrl"),
      getGlobalSetting("showFloatingDiscord"),
    ]);
    if (savedUrl) url = savedUrl;
    if (savedEnabled === "false") enabled = false;
  } catch {
    // DB tidak tersedia — gunakan default.
  }
  return ok({ url, enabled });
});
