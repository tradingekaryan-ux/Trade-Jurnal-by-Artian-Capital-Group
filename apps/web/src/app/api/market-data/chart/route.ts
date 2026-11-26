import { bad, handler, ok, requireValue } from "@/server/api";
import { hyperliquid } from "@/server/market-data/hyperliquid";
import { isResolution, type Resolution } from "@/lib/market-data";

const TIMEFRAME_TO_RESOLUTION: Record<string, Resolution> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "60": "1h",
  "1D": "1d",
};

export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const bare = params.get("symbol")?.trim().toUpperCase() ?? "";
  const resolution = TIMEFRAME_TO_RESOLUTION[params.get("timeframe") ?? "60"];
  requireValue(/^[A-Z0-9]{2,20}$/.test(bare), "Invalid chart symbol.");
  requireValue(isResolution(resolution), "Unsupported chart timeframe.");
  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  requireValue(Number.isFinite(from) && Number.isFinite(to) && to > from, "Invalid chart range.");
  requireValue(to - from <= 366 * 86_400_000, "Chart range is too large.");
  try {
    const history = await hyperliquid.history({ symbol: `xyz:${bare}`, resolution, from, to }, "");
    return ok({ bars: history.bars, truncated: history.truncated, warnings: history.warnings });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Chart history failed.", 502);
  }
});
