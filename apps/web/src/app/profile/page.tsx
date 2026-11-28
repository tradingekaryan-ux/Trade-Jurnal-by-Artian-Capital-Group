"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerifiedBadge, RoleName } from "@/components/verified-badge";
import { postJson, useMutation } from "@/lib/use-api";
import { useToast } from "@/components/ui/toast";

interface OwnPost {
  id: string;
  userId: string;
  title: string;
  description: string;
  kind: "promo" | "idea";
  promoCode: string | null;
  codeEnabled: boolean;
  url: string | null;
  urlEnabled: boolean;
  hasImage: boolean;
  createdAt: string;
}

interface PostForm {
  title: string;
  description: string;
  promoCode: string;
  codeEnabled: boolean;
  url: string;
  urlEnabled: boolean;
}

interface Profile {
  username: string;
  role: string;
  created_at: string;
  display_name: string;
  bio: string;
  journal_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [journalName, setJournalName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [myPosts, setMyPosts] = useState<OwnPost[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PostForm>({
    title: "",
    description: "",
    promoCode: "",
    codeEnabled: false,
    url: "",
    urlEnabled: false,
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { show: showToast } = useToast();

  const load = () => {
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { profile: Profile | null }) => {
        setProfile(body.profile);
        setDisplayName(body.profile?.display_name ?? "");
        setBio(body.profile?.bio ?? "");
        setJournalName(body.profile?.journal_name ?? "");
      })
      .catch(() => setError("Gagal memuat profil."))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    Promise.all([
      fetch("/api/auth").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/posts").then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([session, body]: [{ id: string | null }, { posts: OwnPost[] }]) => {
        setMyPosts(body.posts.filter((post) => post.userId === session.id));
      })
      .catch(() => setMyPosts([]));
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("displayName", displayName);
      form.set("bio", bio);
      form.set("journalName", journalName);
      if (avatar) form.set("avatar", avatar);
      if (banner) form.set("banner", banner);
      const response = await fetch("/api/profile", { method: "PATCH", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal menyimpan profil.");
      setAvatar(null);
      setBanner(null);
      showToast({ title: "Profil tersimpan.", variant: "success" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan profil.");
      showToast({
        title: "Gagal menyimpan profil.",
        description: cause instanceof Error ? cause.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (post: OwnPost) => {
    setEditingId(post.id);
    setEditForm({
      title: post.title,
      description: post.description ?? "",
      promoCode: post.promoCode ?? "",
      codeEnabled: post.codeEnabled,
      url: post.url ?? "",
      urlEnabled: post.urlEnabled,
    });
    setError("");
    setMessage("");
  };

  const savePostMutation = useMutation({
    url: "/api/promos",
    method: "PATCH",
    successTitle: "Postingan diperbarui.",
    errorTitle: "Gagal memperbarui postingan.",
    onSuccess: () => {
      setEditingId(null);
      Promise.all([
        fetch("/api/auth").then((r) => r.json()),
        fetch("/api/posts").then((r) => r.json()),
      ]).then(([session, body]: [{ id: string | null }, { posts: OwnPost[] }]) => {
        setMyPosts(body.posts.filter((item) => item.userId === session.id));
      });
    },
  });

  const savePost = async (post: OwnPost) => {
    setError("");
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        id: post.id,
        title: editForm.title,
        description: editForm.description,
      };
      if (post.kind === "promo") {
        payload.promoCode = editForm.promoCode;
        payload.codeEnabled = editForm.codeEnabled;
        payload.url = editForm.url;
        payload.urlEnabled = editForm.urlEnabled;
      }
      await savePostMutation.mutate(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui postingan.");
    }
  };

  const removePost = async (post: OwnPost) => {
    const label = post.kind === "idea" ? "trade idea" : "promo";
    if (!window.confirm(`Hapus ${label} "${post.title}" beserta semua votingnya?`)) return;
    try {
      await postJson(`/api/promos?id=${encodeURIComponent(post.id)}`, undefined, "DELETE");
      showToast({
        title: `${label.charAt(0).toUpperCase()}${label.slice(1)} dihapus beserta votingnya.`,
        variant: "success",
      });
      setMyPosts((current) => current.filter((item) => item.id !== post.id));
      if (editingId === post.id) setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus postingan.");
      showToast({
        title: "Gagal menghapus postingan.",
        description: cause instanceof Error ? cause.message : "",
        variant: "destructive",
      });
    }
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
      <FilterBar title="Profile" />
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="h-36 w-full overflow-hidden rounded-md bg-muted">
              {!loading && profile?.banner_url && (
                <img
                  src={profile.banner_url}
                  alt="Banner profil"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            {loading ? (
              <div className="animate-pulse space-y-3" aria-label="Memuat profil">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                </div>
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-muted">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Foto profil"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl">
                        {(profile?.display_name || profile?.username || "?")
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-1 font-semibold">
                      {profile?.display_name || profile?.username || "Profil"}
                      <VerifiedBadge role={profile?.role} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{profile?.username} · <RoleName role={profile?.role ?? "member"} />
                    </p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {profile?.bio || "Belum ada bio."}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="profile-name">Nama tampilan</Label>
              <Input
                id="profile-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-bio">Bio</Label>
              <textarea
                id="profile-bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={2000}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-journal">Nama jurnal (muncul di ranking)</Label>
              <Input
                id="profile-journal"
                value={journalName}
                onChange={(e) => setJournalName(e.target.value)}
                maxLength={80}
                placeholder="Jurnal Trading Saya"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="profile-avatar">Foto profil (opsional)</Label>
                <Input
                  id="profile-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile-banner">Banner (opsional)</Label>
                <Input
                  id="profile-banner"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setBanner(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            {(error || message) && (
              <p className={`text-sm ${error ? "text-destructive" : "text-profit"}`}>
                {error || message}
              </p>
            )}
            <Button onClick={save} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan profil"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Postingan saya</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Kelola promo dan trade idea Anda di sini. Perubahan pada voting tidak mengubah
              postingan orang lain.
            </p>
            {myPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada postingan.</p>
            ) : (
              <ul className="divide-y">
                {myPosts.map((post) => (
                  <li key={post.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium">
                          {post.title}
                          <VerifiedBadge role={profile?.role} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                          post.kind === "idea" ? "bg-loss/15 text-loss" : "bg-profit/15 text-profit"
                        }`}
                      >
                        {post.kind === "idea" ? "Trades Idea" : "Promo & Discount"}
                      </span>
                    </div>

                    {editingId === post.id ? (
                      <div className="space-y-2 rounded-md border p-3">
                        <div className="space-y-1">
                          <Label>Judul</Label>
                          <Input
                            value={editForm.title}
                            maxLength={160}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Deskripsi</Label>
                          <textarea
                            rows={3}
                            value={editForm.description}
                            maxLength={4000}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                          />
                        </div>
                        {post.kind === "promo" && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Promo code</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editForm.promoCode}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, promoCode: e.target.value })
                                  }
                                />
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={editForm.codeEnabled}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, codeEnabled: e.target.checked })
                                    }
                                  />
                                  Aktif
                                </label>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label>URL</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="url"
                                  value={editForm.url}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, url: e.target.value })
                                  }
                                />
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={editForm.urlEnabled}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, urlEnabled: e.target.checked })
                                    }
                                  />
                                  Aktif
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={savePostMutation.loading}
                            onClick={() => void savePost(post)}
                          >
                            Simpan postingan
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {post.kind === "promo" && post.codeEnabled && post.promoCode && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copy(post.promoCode!)}
                          >
                            Salin: {post.promoCode}
                          </Button>
                        )}
                        {post.kind === "promo" && post.urlEnabled && post.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm underline"
                          >
                            Kunjungi situs ↗
                          </a>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => startEdit(post)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void removePost(post)}>
                          Hapus
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
