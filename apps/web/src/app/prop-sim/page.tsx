"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { postJson } from "@/lib/use-api";
import { fmtNumber } from "@/lib/utils";

interface Challenge {
  key: string;
  firm: string;
  name: string;
  productType: string;
  provenance: string;
  inferredFields: string[];
}
interface Firm {
  id: string;
  name: string;
  challenges: Challenge[];
}
interface Result {
  challenge: { firm: string; name: string; provenance: string; inferredFields: string[] };
  passProbability: number;
  passCi: { low: number; high: number };
  steps: { index: number; passProbability: number }[];
  failureBreakdown: Record<string, number>;
  stagnationDays: { p50: number; p90: number };
  fundedProbability: number;
  cost: { mean: number; p50: number; p90: number };
  costGivenFunded: { mean: number } | null;
  daysToFunded: { p50: number; p90: number } | null;
  evTotal: number;
  evStandardError: number;
  pPositive: number;
  payoutProbability: number | null;
  blownProbability: number | null;
  assumptions: { id: string; detail: string }[];
}

export default function PropSimPage() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmId, setFirmId] = useState("");
  const [key, setKey] = useState("");
  const [winRate, setWinRate] = useState("48");
  const [avgWinR, setAvgWinR] = useState("1.6");
  const [tradesPerDay, setTradesPerDay] = useState("4");
  const [risk, setRisk] = useState("1");
  const [paths, setPaths] = useState("10000");
  const [seed, setSeed] = useState("42");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    fetch("/api/prop-sim/firms")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { firms: Firm[] }) => {
        setFirms(body.firms);
        const first = body.firms[0];
        if (first) {
          setFirmId(first.id);
          setKey(first.challenges[0]?.key ?? "");
        }
      })
      .catch(() => setError("Gagal memuat daftar prop firm."));
  }, []);

  const challenges = firms.find((firm) => firm.id === firmId)?.challenges ?? [];

  const run = async () => {
    setBusy(true);
    setElapsed(0);
    setError("");
    setResult(null);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    try {
      const body = await postJson<Result>("/api/prop-sim/simulate", {
        key,
        winRate: Number(winRate) / 100,
        avgWinR: Number(avgWinR),
        tradesPerDay: Number(tradesPerDay),
        risk: Number(risk),
        paths: Number(paths),
        seed: Number(seed),
      });
      setResult(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Simulasi gagal.");
    } finally {
      window.clearInterval(timer);
      setBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title="Strategy lab" />
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Uji strategi Anda terhadap aturan prop firm memakai Monte Carlo deterministik dari
          `@luxalgo/prop-firm-sim-core`. Data aturan diambil dari direktori publik LuxAlgo; semua
          asumsi ditampilkan di hasil. Ini simulasi, bukan prediksi atau nasihat investasi.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Parameter strategi & challenge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="sim-firm">Prop firm</Label>
                <OptionSelect
                  id="sim-firm"
                  value={firmId}
                  onValueChange={(value) => {
                    setFirmId(value);
                    setKey(firms.find((firm) => firm.id === value)?.challenges[0]?.key ?? "");
                  }}
                >
                  {firms.map((firm) => (
                    <option key={firm.id} value={firm.id}>
                      {firm.name}
                    </option>
                  ))}
                </OptionSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sim-challenge">Challenge</Label>
                <OptionSelect id="sim-challenge" value={key} onValueChange={setKey}>
                  {challenges.map((challenge) => (
                    <option key={challenge.key} value={challenge.key}>
                      {challenge.name}
                    </option>
                  ))}
                </OptionSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sim-win">Win rate (%)</Label>
                <Input
                  id="sim-win"
                  inputMode="decimal"
                  value={winRate}
                  onChange={(e) => setWinRate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sim-avg">Avg win (R)</Label>
                <Input
                  id="sim-avg"
                  inputMode="decimal"
                  value={avgWinR}
                  onChange={(e) => setAvgWinR(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sim-tpd">Trade / hari</Label>
                <Input
                  id="sim-tpd"
                  inputMode="decimal"
                  value={tradesPerDay}
                  onChange={(e) => setTradesPerDay(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sim-risk">Risk / trade (%)</Label>
                <Input
                  id="sim-risk"
                  inputMode="decimal"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sim-paths">Paths</Label>
                <Input
                  id="sim-paths"
                  inputMode="numeric"
                  value={paths}
                  onChange={(e) => setPaths(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sim-seed">Seed</Label>
                <Input
                  id="sim-seed"
                  inputMode="numeric"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {busy && (
              <div className="space-y-2" role="status" aria-live="polite">
                <div className="sim-progress" />
                <p className="text-xs text-muted-foreground">
                  Menjalankan {Number(paths).toLocaleString()} paths · {elapsed} detik · mohon
                  tunggu, simulasi berjalan di server.
                </p>
              </div>
            )}
            <Button onClick={run} disabled={busy || !key || firms.length === 0}>
              {busy ? "Menjalankan…" : "Jalankan simulasi"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {result.challenge.firm} · {result.challenge.name} · provenance:{" "}
              {result.challenge.provenance}
              {result.challenge.inferredFields.length > 0 &&
                ` · field inferred: ${result.challenge.inferredFields.join(", ")}`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-4 text-xs">
                  Probabilitas lulus
                  <div className="text-lg font-semibold">
                    {fmtNumber(result.passProbability * 100, 1)}%
                  </div>
                  <div className="text-muted-foreground">
                    CI {fmtNumber(result.passCi.low * 100, 1)}–
                    {fmtNumber(result.passCi.high * 100, 1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  Funded within 25 attempts
                  <div className="text-lg font-semibold">
                    {fmtNumber(result.fundedProbability * 100, 1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  Biaya rata-rata
                  <div className="text-lg font-semibold">${fmtNumber(result.cost.mean, 2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  EV total
                  <div className="text-lg font-semibold">${fmtNumber(result.evTotal, 2)}</div>
                  <div className="text-muted-foreground">
                    ± {fmtNumber(result.evStandardError * 1.96, 2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  P(EV &gt; 0)
                  <div className="text-lg font-semibold">
                    {fmtNumber(result.pPositive * 100, 1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  Probabilitas payout | funded
                  <div className="text-lg font-semibold">
                    {result.payoutProbability === null
                      ? "—"
                      : `${fmtNumber(result.payoutProbability * 100, 1)}%`}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  Funded blown
                  <div className="text-lg font-semibold">
                    {result.blownProbability === null
                      ? "—"
                      : `${fmtNumber(result.blownProbability * 100, 1)}%`}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs">
                  Stagnasi (hari)
                  <div className="text-lg font-semibold">
                    p50 {fmtNumber(result.stagnationDays.p50, 0)} · p90{" "}
                    {fmtNumber(result.stagnationDays.p90, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Per step</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="p-2">Step</th>
                      <th className="p-2">Pass probability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.steps.map((step) => (
                      <tr key={step.index} className="border-t">
                        <td className="p-2">{step.index + 1}</td>
                        <td className="p-2">{fmtNumber(step.passProbability * 100, 2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Asumsi & batas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {result.assumptions.map((flag) => (
                    <li key={flag.id}>
                      <strong>{flag.id}</strong>: {flag.detail}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
