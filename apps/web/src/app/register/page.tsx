"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArtianLogo } from "@/components/artian-mark";
import { PoweredByLuxAlgo } from "@/components/powered-by-luxalgo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/use-api";

export default function RegisterPage() {
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
      await postJson("/api/register", { username, password });
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registrasi gagal.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="text-center">
              <ArtianLogo className="mx-auto mb-3 h-16 w-auto" />
              <h1 className="text-sm font-semibold">Buat akun gratis</h1>
            </div>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username (3–32 karakter)"
              autoComplete="username"
              autoFocus
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (minimal 8 karakter)"
              autoComplete="new-password"
            />
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Mendaftar…" : "Daftar"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Tanpa email, tanpa verifikasi. Langsung bisa dipakai.{" "}
              <Link href="/login" className="underline underline-offset-2">
                Sudah punya akun?
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <PoweredByLuxAlgo className="mt-4 text-center" />
    </div>
  );
}
