import { JournalPage } from "@/components/journal-page";

export default function FuturesJournalRoute() {
  return (
    <JournalPage
      title="Futures journal"
      description="Jurnal futures berbasis tick: kontrak standar, mini, micro, dan nano. Tick size serta nilai per tick diambil dari katalog instrumen."
      modes={["futures"]}
      categories={["futures"]}
    />
  );
}
