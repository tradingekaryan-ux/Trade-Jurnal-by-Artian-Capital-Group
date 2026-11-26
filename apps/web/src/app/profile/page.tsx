"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OwnPost {
  id: string;
  userId: string;
  title: string;
  kind: "promo" | "idea";
  hasImage: boolean;
  createdAt: string;
}

interface Profile {
  username: string;
  role: string;
  created_at: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [myPosts, setMyPosts] = useState<OwnPost[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { profile: Profile | null }) => {
        setProfile(body.profile);
        setDisplayName(body.profile?.display_name ?? "");
        setBio(body.profile?.bio ?? "");
      })
      .catch(() => setError("Gagal memuat profil."));
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
      if (avatar) form.set("avatar", avatar);
      if (banner) form.set("banner", banner);
      const response = await fetch("/api/profile", { method: "PATCH", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal menyimpan profil.");
      setAvatar(null);
      setBanner(null);
      setMessage("Profil tersimpan.");
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan profil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title="Profile" />
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="h-36 w-full overflow-hidden rounded-md bg-muted">
              {profile?.banner_url && (
                <img
                  src={profile.banner_url}
                  alt="Banner profil"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
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
                    {(profile?.display_name || profile?.username || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold">
                  {profile?.display_name || profile?.username || "Profil"}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  @{profile?.username} · {profile?.role}
                </p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {profile?.bio || "Belum ada bio."}
            </p>
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
          <CardHeader><CardTitle>Postingan saya</CardTitle></CardHeader>
          <CardContent>
            {myPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada postingan.</p>
            ) : (
              <ul className="divide-y">
                {myPosts.map((post) => (
                  <li key={post.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{post.title}</p>
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
