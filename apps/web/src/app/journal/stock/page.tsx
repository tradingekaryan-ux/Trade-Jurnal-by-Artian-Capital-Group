import { JournalPage } from "@/components/journal-page";

export default function StockJournalRoute() {
  return (
    <JournalPage
      title="US Stock journal"
      description="Jurnal saham AS (%) dari pair tradfi Hyperliquid (HIP-3)."
      modes={["stock"]}
      categories={["stock"]}
    />
  );
}
