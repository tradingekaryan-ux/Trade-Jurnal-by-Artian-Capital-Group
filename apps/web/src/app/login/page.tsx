"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArtianMark } from "@/components/artian-mark";
import { PoweredByLuxAlgo } from "@/components/powered-by-luxalgo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/use-api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth", { username, password });
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login gagal.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="text-center">
              <ArtianMark className="mx-auto mb-2 h-7 w-7" />
              <h1 className="text-sm font-semibold">Trade Jurnal</h1>
              <p className="text-xs text-muted-foreground">by Artian Capital Group</p>
            </div>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              autoComplete="username"
              autoFocus
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
            />
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Masuk…" : "Masuk"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Belum punya akun?{" "}
              <Link href="/register" className="underline underline-offset-2">
                Daftar gratis
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <PoweredByLuxAlgo className="mt-4 text-center" />
    </div>
  );
}
