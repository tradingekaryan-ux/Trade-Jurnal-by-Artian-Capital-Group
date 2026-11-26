import { MessageCircle } from "lucide-react";

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.com/";

/** Floating Discord shortcut, visible on every page. */
export function FloatingDiscord() {
  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Gabung Discord"
      title="Gabung Discord"
      className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#5865F2] text-white shadow-lg shadow-black/40 transition-transform hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
