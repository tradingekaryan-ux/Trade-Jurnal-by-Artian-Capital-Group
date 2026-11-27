import { handler, ok } from "@/server/api";
import { getRanking } from "@/server/ranking";

/** Public leaderboard. Rankings are recomputed from Supabase on every request. */
export const GET = handler(
  async () =>
    ok({
      rankedAt: new Date().toISOString(),
      entries: await getRanking(),
    }),
  { public: true },
);
