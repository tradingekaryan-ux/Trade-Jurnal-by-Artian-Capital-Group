import { handler, ok } from "@/server/api";
import { getRanking } from "@/server/ranking";
import { getGlobalSetting } from "@/server/settings";

const DEFAULT_DISCORD = process.env.NEXT_PUBLIC_DISCORD_URL?.trim() || "https://discord.com/";

/** Public leaderboard. Rankings are recomputed from Supabase on every request. */
export const GET = handler(
  async () => {
    const [entries, savedDiscord] = await Promise.all([
      getRanking(),
      getGlobalSetting("discordUrl").catch(() => null),
    ]);
    return ok({
      rankedAt: new Date().toISOString(),
      discordUrl: savedDiscord || DEFAULT_DISCORD,
      entries,
    });
  },
  { public: true },
);
