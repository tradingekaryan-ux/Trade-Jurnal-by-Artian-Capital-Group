import { JournalPage } from "@/components/journal-page";

export default function CfdJournalRoute() {
  return (
    <JournalPage
      title="CFD journal"
      description="Jurnal CFD berbasis pips: lot, USD per pip per lot, stop loss, take profit, dan kalkulasi P&L otomatis dari selisih harga."
      modes={["cfd"]}
      categories={["forex", "commodity", "indice"]}
    />
  );
}
