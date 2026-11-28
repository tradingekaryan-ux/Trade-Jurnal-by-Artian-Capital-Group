"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoteBar } from "@/components/vote-bar";
import { VerifiedBadge } from "@/components/verified-badge";
import { postJson } from "@/lib/use-api";
import { useToast } from "@/components/ui/toast";

import type { Post } from "@/lib/posts";

interface IdeaVote {
  stopLoss: number;
  takeProfit: number;
  mine: "stop_loss" | "take_profit" | null;
}
interface Session {
  id: string | null;
  authenticated: boolean;
  username: string | null;
}

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Record<string, IdeaVote>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const loadVotes = (items: Post[]) => {
    if (!items.length) return setVotes({});
    fetch(`/api/ideas/vote?ids=${encodeURIComponent(items.map((i) => i.id).join(","))}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { votes: Record<string, IdeaVote> }) => setVotes(body.votes))
      .catch(() => setVotes({}));
  };

  const load = () => {
    fetch("/api/posts")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { posts: Post[] }) => {
        const onlyIdeas = body.posts.filter((post) => post.kind === "idea");
        setIdeas(onlyIdeas);
        loadVotes(onlyIdeas);
      })
      .catch(() => setError("Gagal memuat trade idea."));
  };

  useEffect(() => {
    load();
    fetch("/api/auth")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: Session) => setSession(body))
      .catch(() => setSession(null));
  }, []);

  const { show: showToast } = useToast();

  const submit = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("kind", "idea");
      form.set("title", title);
      form.set("description", description);
      if (image) form.set("image", image);
      const response = await fetch("/api/promos", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal memposting idea.");
      setTitle("");
      setDescription("");
      setImage(null);
      showToast({ title: "Trade idea berhasil diposting.", variant: "success" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memposting idea.");
      showToast({
        title: "Gagal memposting idea.",
        description: cause instanceof Error ? cause.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const summarize = async () => {
    setAiBusy(true);
    setError("");
    try {
      const result = await postJson<{ text: string }>("/api/ai/community", { kind: "idea" });
      setAiSummary(result.text);
      showToast({ title: "Ringkasan AI selesai.", variant: "success" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat ringkasan AI.");
      showToast({
        title: "Gagal membuat ringkasan AI.",
        description: cause instanceof Error ? cause.message : "",
        variant: "destructive",
      });
    } finally {
      setAiBusy(false);
    }
  };

  const vote = async (idea: Post, value: IdeaVote["mine"]) => {
    if (!value) return;
    try {
      const response = await fetch("/api/ideas/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: idea.id, value }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal memberi vote.");
      setVotes((current) => ({ ...current, [idea.id]: body as IdeaVote }));
      showToast({ title: "Vote tersimpan.", variant: "success" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memberi vote.");
      showToast({
        title: "Gagal memberi vote.",
        description: cause instanceof Error ? cause.message : "",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <FilterBar title="Trades Idea" />
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Bagikan ide trading Anda. <strong>Gambar wajib</strong> diunggah. Komunitas bisa memberi
          testimoni apakah ide tersebut akhirnya kena <strong>Stop Loss</strong> atau{" "}
          <strong>Take Profit</strong>. Untuk mengedit atau menghapus idea Anda sendiri, buka
          halaman{" "}
          <a href="/profile" className="underline">
            Profile
          </a>
          .
        </p>

        {aiSummary && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>AI · Konsensus komunitas</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setAiSummary("")}>
                Tutup
              </Button>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{aiSummary}</p>
            </CardContent>
          </Card>
        )}
        <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => void summarize()}>
          {aiBusy ? "Meringkas…" : "AI ringkasan ide"}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Buat trade idea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="idea-title">Judul</Label>
                <Input
                  id="idea-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Setup breakout XAUUSD"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="idea-image">Gambar (wajib)</Label>
                <Input
                  id="idea-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="idea-description">Deskripsi</Label>
              <textarea
                id="idea-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Konteks, entry, SL/TP, dan alasan setup…"
              />
            </div>
            {(error || message) && (
              <p className={`text-sm ${error ? "text-destructive" : "text-profit"}`}>
                {error || message}
              </p>
            )}
            <Button onClick={submit} disabled={busy || title.trim().length < 2 || !image}>
              {busy ? "Memposting…" : "Posting idea"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {ideas.map((idea) => (
            <Card key={idea.id}>
              <CardContent className="space-y-2 pt-4">
                {idea.hasImage && (
                  <img
                    src={`/api/promos/${encodeURIComponent(idea.id)}/image`}
                    alt={idea.title}
                    className="h-40 w-full rounded-md object-cover"
                  />
                )}
                <h3 className="font-semibold">{idea.title}</h3>
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  oleh {idea.author}
                  <VerifiedBadge role={idea.authorRole} />
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {idea.description}
                </p>
                <VoteBar
                  sides={[
                    { label: "Stop Loss", count: votes[idea.id]?.stopLoss ?? 0, tone: "loss" },
                    {
                      label: "Take Profit",
                      count: votes[idea.id]?.takeProfit ?? 0,
                      tone: "profit",
                    },
                  ]}
                />
                <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                  <Button
                    size="sm"
                    variant={votes[idea.id]?.mine === "stop_loss" ? "destructive" : "outline"}
                    disabled={!session?.authenticated}
                    onClick={() => void vote(idea, "stop_loss")}
                  >
                    Stop Loss · {votes[idea.id]?.stopLoss ?? 0}
                  </Button>
                  <Button
                    size="sm"
                    variant={votes[idea.id]?.mine === "take_profit" ? "default" : "outline"}
                    disabled={!session?.authenticated}
                    onClick={() => void vote(idea, "take_profit")}
                  >
                    Take Profit · {votes[idea.id]?.takeProfit ?? 0}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {ideas.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada trade idea.</p>
          )}
        </div>
      </div>
    </div>
  );
}
