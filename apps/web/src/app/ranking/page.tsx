"use client";

import { Fragment, useEffect, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/verified-badge";

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

  useEffect(() => {
    fetch("/api/ranking")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { rankedAt: string; entries: Entry[] }) => {
        setEntries(body.entries);
        setRankedAt(body.rankedAt);
      })
      .catch(() => setError("Gagal memuat ranking."));
  }, []);

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
                            onClick={() =>
                              window.open(
                                `/api/ranking/certificate?userId=${encodeURIComponent(entry.userId)}`,
                                "_blank",
                              )
                            }
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
