"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { OptionSelect } from "./ui/option-select";
import { postJson } from "@/lib/use-api";

/** AI performance recap tied to the public Edge Score ranking. */
export function AiPerformanceCard() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [text, setText] = useState("");
  const [rank, setRank] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ text: string; rank: number | null }>("/api/ai/performance", {
        period,
      });
      setText(result.text);
      setRank(result.rank);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat laporan AI.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>AI Performance Recap</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <OptionSelect
            value={period}
            onValueChange={(value) => setPeriod(value as "week" | "month")}
            className="w-32"
          >
            <option value="week">7 hari</option>
            <option value="month">30 hari</option>
          </OptionSelect>
          <Button size="sm" disabled={busy} onClick={() => void generate()}>
            {busy ? "Menganalisis…" : "Analisis performa"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/api/ai/performance/pdf?period=${period}`, "_blank")}
          >
            Unduh PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rank !== null && (
          <p className="text-xs text-muted-foreground">
            Peringkat leaderboard saat laporan dibuat: #{rank}
          </p>
        )}
        {text && <p className="whitespace-pre-wrap text-sm">{text}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!text && !error && (
          <p className="text-sm text-muted-foreground">
            Ringkasan Edge Score dan saran perbaikan dari data jurnal CFD/Futures/Crypto/Stock Anda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
