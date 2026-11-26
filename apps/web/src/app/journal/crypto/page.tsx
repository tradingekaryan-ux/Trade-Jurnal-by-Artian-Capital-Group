import { JournalPage } from "@/components/journal-page";

export default function CryptoJournalRoute() {
  return (
    <JournalPage
      title="Crypto journal"
      description="Jurnal crypto spot (%) dan perpetual (% × leverage) dengan data feed Hyperliquid."
      modes={["crypto-spot", "crypto-perp"]}
      categories={["crypto-spot", "crypto-perp"]}
    />
  );
}
