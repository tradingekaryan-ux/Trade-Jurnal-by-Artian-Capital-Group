import { JournalPage } from "@/components/journal-page";

export default function FuturesJournalRoute() {
  return (
    <JournalPage
      title="Futures journal"
      description="Jurnal futures berbasis tick — belum tersedia."
      modes={["futures"]}
      categories={["indice", "commodity"]}
      comingSoon
    />
  );
}
