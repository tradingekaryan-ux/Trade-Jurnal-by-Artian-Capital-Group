"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canEditPromo, canModeratePromos, isUserRole, type UserRole } from "@/lib/roles";

interface Promo {
  id: string;
  userId: string;
  author: string;
  title: string;
  description: string;
  imageMime: string | null;
  hasImage: boolean;
  promoCode: string | null;
  codeEnabled: boolean;
  url: string | null;
  urlEnabled: boolean;
  createdAt: string;
}

interface Session {
  id: string | null;
  authenticated: boolean;
  username: string | null;
  role: UserRole;
}

export default function PromoPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [codeEnabled, setCodeEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [urlEnabled, setUrlEnabled] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/promos")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { promos: Promo[] }) => setPromos(body.promos))
      .catch(() => setError("Gagal memuat promo."));
  };
  useEffect(() => {
    load();
    fetch("/api/auth")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: Session) => setSession(body))
      .catch(() => setSession(null));
  }, []);

  const role = session && isUserRole(session.role) ? session.role : "member";
  const mayModerate = canModeratePromos(role);

  const submit = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("description", description);
      form.set("promoCode", code);
      form.set("codeEnabled", String(codeEnabled));
      form.set("url", url);
      form.set("urlEnabled", String(urlEnabled));
      if (image) form.set("image", image);
      const response = await fetch("/api/promos", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal membuat promo.");
      setTitle("");
      setDescription("");
      setCode("");
      setCodeEnabled(false);
      setUrl("");
      setUrlEnabled(false);
      setImage(null);
      setMessage("Promo berhasil diposting.");
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat promo.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (promo: Promo, data: Partial<Promo>) => {
    try {
      const response = await fetch("/api/promos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promo.id, ...data }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Gagal memperbarui promo.");
      }
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui promo.");
    }
  };

  const remove = async (promo: Promo) => {
    if (!window.confirm(`Hapus promo "${promo.title}"?`)) return;
    await fetch(`/api/promos?id=${encodeURIComponent(promo.id)}`, { method: "DELETE" });
    load();
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`Promo code ${value} disalin.`);
    } catch {
      setError("Gagal menyalin. Salin manual saja.");
    }
  };

  return (
    <div>
      <FilterBar title="Promo & Discount" />
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Bagikan promo, diskon, atau penawaran. Siapa pun yang punya akun bisa memposting. Promo
          code bisa disalin dengan sekali klik dan URL bisa langsung membuka situs tujuan — keduanya
          bisa diaktifkan atau dinonaktifkan.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Buat promo baru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="promo-title">Judul</Label>
                <Input
                  id="promo-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Diskon 20% trading fee"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-image">Gambar (opsional)</Label>
                <Input
                  id="promo-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="promo-description">Deskripsi</Label>
              <textarea
                id="promo-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Detail penawaran, syarat, dan masa berlaku…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="promo-code">Promo code</Label>
                <div className="flex gap-2">
                  <Input
                    id="promo-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ARTIAN20"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={codeEnabled}
                      onChange={(e) => setCodeEnabled(e.target.checked)}
                    />{" "}
                    Aktif
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-url">URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="promo-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={urlEnabled}
                      onChange={(e) => setUrlEnabled(e.target.checked)}
                    />{" "}
                    Aktif
                  </label>
                </div>
              </div>
            </div>
            {(error || message) && (
              <p className={`text-sm ${error ? "text-destructive" : "text-profit"}`}>
                {error || message}
              </p>
            )}
            <Button onClick={submit} disabled={busy || title.trim().length < 2}>
              {busy ? "Memposting…" : "Posting promo"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {promos.map((promo) => {
            const editable = canEditPromo(role, promo.userId, session?.id ?? "");
            return (
              <Card key={promo.id}>
                <CardContent className="space-y-2 pt-4">
                  {promo.hasImage && (
                    <img
                      src={`/api/promos/${encodeURIComponent(promo.id)}/image`}
                      alt={promo.title}
                      className="h-36 w-full rounded-md object-cover"
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{promo.title}</h3>
                    <span className="text-xs text-muted-foreground">{promo.author}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {promo.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {promo.codeEnabled && promo.promoCode && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void copy(promo.promoCode!)}
                      >
                        Salin: {promo.promoCode}
                      </Button>
                    )}
                    {promo.urlEnabled && promo.url && (
                      <a
                        href={promo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline"
                      >
                        Kunjungi situs ↗
                      </a>
                    )}
                  </div>
                  {editable && (
                    <div className="flex flex-wrap gap-3 border-t pt-2 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={promo.codeEnabled}
                          onChange={(e) => void patch(promo, { codeEnabled: e.target.checked })}
                        />{" "}
                        Code aktif
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={promo.urlEnabled}
                          onChange={(e) => void patch(promo, { urlEnabled: e.target.checked })}
                        />{" "}
                        URL aktif
                      </label>
                      <Button size="sm" variant="ghost" onClick={() => void remove(promo)}>
                        Hapus
                      </Button>
                    </div>
                  )}
                  {mayModerate && !editable && (
                    <p className="text-xs text-muted-foreground">Moderator</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {promos.length === 0 && <p className="text-sm text-muted-foreground">Belum ada promo.</p>}
        </div>
      </div>
    </div>
  );
}
