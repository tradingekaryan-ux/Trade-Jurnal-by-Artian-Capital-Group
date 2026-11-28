import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
import { PrivacyProvider } from "@/components/privacy";
import { FloatingDiscord } from "@/components/floating-discord";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Trade Jurnal by Artian Capital Group",
  description:
    "Jurnal trading gratis — sinkron broker, impor pernyataan, analitik mendalam, kalender P&L, jurnal harian, dan refleksi AI via OpenRouter.",
  icons: {
    icon: "/brand/artian-icon.png",
    shortcut: "/brand/artian-icon.png",
    apple: "/brand/artian-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider delayDuration={350} skipDelayDuration={150}>
          <Suspense>
            <ThemeProvider>
              <PrivacyProvider>
                <ToastProvider>
                  <Shell>{children}</Shell>
                  <FloatingDiscord />
                </ToastProvider>
              </PrivacyProvider>
            </ThemeProvider>
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
