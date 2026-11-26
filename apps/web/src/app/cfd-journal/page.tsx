import { redirect } from "next/navigation";

/** Legacy URL — the CFD journal now lives under /journal/cfd. */
export default function LegacyCfdJournal() {
  redirect("/journal/cfd");
}
