"use client";

import { Fragment, useEffect, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/verified-badge";
import { OptionSelect } from "@/components/ui/option-select";
import { downloadBlob, renderSharePng, type ShareSize } from "@/lib/share-image";

interface JournalSummary {
  mode: string;
  label: string;
  trades: number;
  closed: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  profitFactor: number | null;
  edgeScore: number | null;
}

interface Entry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  journalName: string;
  role: string;
  edgeScore: number | null;
  netPnl: number;
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null;
  journals: JournalSummary[];
}

const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);
const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const score = (value: number | null) => (value === null ? "—" : value.toFixed(1));

export default function RankingPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rankedAt, setRankedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cert, setCert] = useState<{ entry: Entry; size: ShareSize } | null>(null);
  const [certBusy, setCertBusy] = useState(false);
  const [certError, setCertError] = useState("");

  useEffect(() => {
    fetch("/api/ranking")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { rankedAt: string; entries: Entry[] }) => {
        setEntries(body.entries);
        setRankedAt(body.rankedAt);
      })
      .catch(() => setError("Gagal memuat ranking."));
  }, []);

  const downloadCertificate = async () => {
    if (!cert) return;
    setCertBusy(true);
    setCertError("");
    try {
      const issuedAt = new Date().toISOString();
      const blob = await renderSharePng({
        size: cert.size,
        title: "Sertifikat Peringkat Jurnal",
        subtitle: `Trade Jurnal by Artian Capital Group · ${issuedAt.slice(0, 10)}`,
        stats: [
          { label: "Peringkat", value: `#${cert.entry.rank} dari ${entries.length}` },
          { label: "Nama jurnal", value: cert.entry.journalName.slice(0, 28) },
          { label: "Pemilik", value: `@${cert.entry.username}` },
          { label: "Edge Score", value: score(cert.entry.edgeScore) },
          { label: "Trade selesai", value: String(cert.entry.closedTrades) },
          { label: "Win rate", value: percent(cert.entry.winRate) },
          { label: "Net P&L", value: money(cert.entry.netPnl) },
          { label: "Profit factor", value: score(cert.entry.profitFactor) },
        ],
        note: `Diterbitkan ${issuedAt.slice(0, 16).replace("T", " ")} UTC — peringkat dapat berubah.`,
        issuedAt,
        siteUrl: typeof window !== "undefined" ? window.location.origin : "",
      });
      downloadBlob(blob, `sertifikat-${cert.entry.username}-${issuedAt.slice(0, 10)}.png`);
    } catch (cause) {
      setCertError(cause instanceof Error ? cause.message : "Gagal membuat sertifikat.");
    } finally {
      setCertBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title="Ranking Jurnal" />
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <Card>
          <CardContent className="space-y-2 pt-4">
            <h1 className="text-xl font-semibold">Leaderboard Edge Score</h1>
            <p className="text-sm text-muted-foreground">
              Peringkat dihitung dari seluruh jurnal trading di Supabase menggunakan Edge Score v2 —
              kombinasi win rate, profit factor, rasio menang/kalah, drawdown, recovery, dan
              konsistensi. Ranking dapat berubah setiap kali ada trade baru.
            </p>
            {rankedAt && (
              <p className="text-xs text-muted-foreground">
                Dihitung: {new Date(rankedAt).toLocaleString()}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {cert && (
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Sertifikat · {cert.entry.journalName}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setCert(null)}>
                Tutup
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Sertifikat PNG dirender di browser, lengkap dengan tanggal unduhan, tanda tangan Pt.
                Eka Ryan M., dan barcode ke website ini.
              </p>
              <OptionSelect
                value={cert.size}
                onValueChange={(value) => setCert({ ...cert, size: value as ShareSize })}
                className="w-64"
              >
                <option value="1920x1080">1920 × 1080 (landscape)</option>
                <option value="1080x1080">1080 × 1080 (square)</option>
              </OptionSelect>
              {certError && <p className="text-sm text-destructive">{certError}</p>}
              <Button disabled={certBusy} onClick={() => void downloadCertificate()}>
                {certBusy ? "Membuat sertifikat…" : "Unduh sertifikat PNG"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="overflow-x-auto pt-4">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Jurnal</th>
                  <th className="p-2">Pemilik</th>
                  <th className="p-2">Edge</th>
                  <th className="p-2">Trade</th>
                  <th className="p-2">Win rate</th>
                  <th className="p-2">Net P&L</th>
                  <th className="p-2">PF</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Fragment key={entry.userId}>
                    <tr className="border-t">
                      <td className="p-2 font-semibold">{entry.rank}</td>
                      <td className="p-2 font-medium">{entry.journalName}</td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1">
                          {entry.displayName || entry.username}
                          <VerifiedBadge role={entry.role} />
                        </span>
                        <span className="text-muted-foreground"> @{entry.username}</span>
                      </td>
                      <td className="p-2 font-semibold text-brand">{score(entry.edgeScore)}</td>
                      <td className="p-2">{entry.closedTrades}</td>
                      <td className="p-2">{percent(entry.winRate)}</td>
                      <td className={`p-2 ${entry.netPnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {money(entry.netPnl)}
                      </td>
                      <td className="p-2">{score(entry.profitFactor)}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpen(open === entry.userId ? null : entry.userId)}
                          >
                            {open === entry.userId ? "Tutup" : "Detail"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCert({ entry, size: cert?.size ?? "1920x1080" })}
                          >
                            Sertifikat
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {open === entry.userId && (
                      <tr className="border-t bg-muted/20">
                        <td className="p-3" colSpan={9}>
                          <p className="mb-2 font-medium">Edge score per jurnal</p>
                          {entry.journals.length === 0 && (
                            <p className="text-muted-foreground">Belum ada trade.</p>
                          )}
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {entry.journals.map((journal) => (
                              <div key={journal.mode} className="rounded-md border p-2">
                                <p className="font-medium">{journal.label}</p>
                                <p className="text-muted-foreground">
                                  Edge {score(journal.edgeScore)} · {journal.closed} trade selesai ·{" "}
                                  {percent(journal.winRate)} win · {money(journal.netPnl)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={9}>
                      Belum ada jurnal untuk diranking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
