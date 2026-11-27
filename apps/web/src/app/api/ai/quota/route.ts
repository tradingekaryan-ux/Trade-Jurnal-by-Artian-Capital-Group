import { handler, ok } from "@/server/api";
import { getQuota } from "@/server/settings";

/** Lightweight quota readout for the sidebar/header (no model catalog payload). */
export const GET = handler(async () => ok(await getQuota()));
