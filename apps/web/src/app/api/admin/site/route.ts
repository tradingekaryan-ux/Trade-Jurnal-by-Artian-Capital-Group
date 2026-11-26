import { bad, handler, ok, requireValue } from "@/server/api";
import { currentUser } from "@/server/auth";
import { getGlobalSetting, setGlobalSetting } from "@/server/settings";
import { canManageSite } from "@/lib/roles";

const ownerOnly = async () => {
  const user = await currentUser();
  return Boolean(user && canManageSite(user.role));
};

const validUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const DEFAULT_DISCORD = process.env.NEXT_PUBLIC_DISCORD_URL?.trim() || "https://discord.com/";

export const GET = handler(async () => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  const [discordUrl, showFloatingDiscord, siteTitle] = await Promise.all([
    getGlobalSetting("discordUrl"),
    getGlobalSetting("showFloatingDiscord"),
    getGlobalSetting("siteTitle"),
  ]);
  return ok({
    discordUrl: discordUrl || DEFAULT_DISCORD,
    showFloatingDiscord: showFloatingDiscord !== "false",
    siteTitle: siteTitle ?? "",
  });
});

export const POST = handler(async (request: Request) => {
  if (!(await ownerOnly())) return bad("Forbidden", 403);
  const body = (await request.json()) as {
    discordUrl?: string;
    showFloatingDiscord?: boolean;
    siteTitle?: string;
  };
  const discordUrl = typeof body.discordUrl === "string" ? body.discordUrl.trim() : "";
  requireValue(!discordUrl || validUrl(discordUrl), "URL Discord harus http:// atau https://.");
  requireValue(
    typeof body.siteTitle === "undefined" ||
      (typeof body.siteTitle === "string" && body.siteTitle.length <= 120),
    "Judul situs terlalu panjang.",
  );
  await Promise.all([
    setGlobalSetting("discordUrl", discordUrl || DEFAULT_DISCORD),
    setGlobalSetting("showFloatingDiscord", body.showFloatingDiscord === false ? "false" : "true"),
    setGlobalSetting("siteTitle", typeof body.siteTitle === "string" ? body.siteTitle.trim() : ""),
  ]);
  return ok({ saved: true });
});
