"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { PoweredByLuxAlgo } from "@/components/powered-by-luxalgo";
import { LogoutButton } from "@/components/user-menu";
import { VerifiedBadge, RoleName } from "@/components/verified-badge";
import { postJson } from "@/lib/use-api";
import {
  ROLE_LABELS,
  USER_ROLES,
  canAccessAdmin,
  canDeleteAccounts,
  canManageSite,
  isUserRole,
  type UserRole,
} from "@/lib/roles";

interface ModelRow {
  id: string;
  name: string;
  tier: "free" | "paid";
  contextLength: number | null;
  supportsPdf: boolean;
  supportsVision: boolean;
  enabled: boolean;
  isDefault: boolean;
  source: "openrouter" | "admin";
}

interface AdminData {
  models: ModelRow[];
  defaultModel: string;
  quota: number;
  paidAllowed: boolean;
  lastSync: string | null;
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

interface MemberRow extends AdminUser {
  lastLoginAt: string | null;
  trades: number;
  wins: number;
  losses: number;
  running: number;
  snapshotUpdatedAt: string | null;
}

interface MemberDetail {
  user: { id: string; username: string; role: string };
  trades: Record<string, unknown>[];
  promos: Record<string, unknown>[];
  snapshot: Record<string, unknown[]> | null;
  snapshotUpdatedAt: string | null;
}

interface SiteConfig {
  discordUrl: string;
  showFloatingDiscord: boolean;
  siteTitle: string;
}

interface KeySlot {
  slot: number;
  configured: boolean;
  masked: string | null;
}

const MODEL_EXAMPLES = `openrouter/free
antdigital/lingdt-decision-fast-1.0:free
fish-audio/s2.1-pro-free:free`;

const emptySite: SiteConfig = {
  discordUrl: "https://discord.com/",
  showFloatingDiscord: true,
  siteTitle: "",
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [detail, setDetail] = useState<{ name: string; data: MemberDetail } | null>(null);
  const [site, setSite] = useState<SiteConfig>(emptySite);
  const [keySlots, setKeySlots] = useState<KeySlot[]>([]);
  const [modelInput, setModelInput] = useState("");
  const [newModelCaps, setNewModelCaps] = useState({ supportsPdf: false, supportsVision: false });
  const [keyDrafts, setKeyDrafts] = useState<Record<number, string>>({});
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "member" as UserRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const load = () => {
    fetch("/api/admin/models")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: AdminData) => setData(body))
      .catch(() => setError("Akses admin diperlukan."));
  };
  useEffect(load, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { role: string }) => setRole(isUserRole(body.role) ? body.role : "member"))
      .catch(() => setRole("member"));
  }, []);

  const loadUsers = () => {
    fetch("/api/admin/users")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { users: AdminUser[] }) => setUsers(body.users))
      .catch(() => setError("Gagal memuat user."));
  };
  const loadMembers = () => {
    fetch("/api/admin/member-data")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { members: MemberRow[] }) => setMembers(body.members))
      .catch(() => setError("Gagal memuat data member."));
  };
  useEffect(() => {
    if (role !== null && canAccessAdmin(role)) {
      loadUsers();
      loadMembers();
    }
  }, [role]);

  const loadKeys = () => {
    fetch("/api/admin/keys")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { slots: KeySlot[] }) => setKeySlots(body.slots))
      .catch(() => setError("Gagal memuat kunci OpenRouter."));
  };

  useEffect(() => {
    if (role !== "owner") return;
    fetch("/api/admin/site")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: SiteConfig) => setSite(body))
      .catch(() => setError("Gagal memuat konfigurasi situs."));
    loadKeys();
  }, [role]);

  const createUser = async () => {
    try {
      await postJson("/api/admin/users", newUser);
      setNewUser({ username: "", password: "", role: "member" });
      setMessage("User berhasil dibuat.");
      loadUsers();
      loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat user.");
    }
  };

  const changeRole = async (id: string, next: string) => {
    try {
      await postJson("/api/admin/users", { id, role: next }, "PATCH");
      setMessage("Role diperbarui.");
      loadUsers();
      loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengubah role.");
    }
  };

  const removeUser = async (user: AdminUser) => {
    const member = members.find((item) => item.id === user.id);
    const summary = [
      `${member?.trades ?? 0} trade`,
      `${member?.wins ?? 0} profit`,
      `${member?.losses ?? 0} loss`,
    ].join(", ");
    if (
      !window.confirm(
        `Hapus akun "${user.username}"? Seluruh data akun akan dihapus permanen: ${summary}, postingan & voting, notebook, playbook, jurnal, profil, sesi, dan cache lokal.`,
      )
    )
      return;
    try {
      const result = await postJson<{ removed: Record<string, number> }>(
        "/api/admin/users",
        { id: user.id },
        "DELETE",
      );
      const removed = result.removed ?? {};
      setMessage(
        `Akun ${user.username} dihapus: ${removed.trades ?? 0} trade, ${removed.posts ?? 0} postingan, ` +
          `${(removed.receivedVotes ?? 0) + (removed.castVotes ?? 0)} vote, ${removed.images ?? 0} gambar, ` +
          `${removed.snapshots ?? 0} snapshot, ${removed.sessions ?? 0} sesi.`,
      );
      if (detail?.data.user.id === user.id) setDetail(null);
      loadUsers();
      loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus akun.");
    }
  };

  const openDetail = async (member: MemberRow) => {
    try {
      const body = await fetch(
        `/api/admin/member-data?userId=${encodeURIComponent(member.id)}`,
      ).then((response) => (response.ok ? response.json() : Promise.reject()));
      setDetail({ name: member.username, data: body as MemberDetail });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat detail member.");
    }
  };

  const saveSite = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await postJson("/api/admin/site", site);
      setMessage(
        "Konfigurasi situs disimpan. Tombol Discord akan diperbarui pada halaman berikutnya.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan konfigurasi.");
    } finally {
      setBusy(false);
    }
  };

  const addModels = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await postJson<{ added: number; skipped: number }>("/api/admin/models", {
        action: "add",
        ids: modelInput,
        supportsPdf: newModelCaps.supportsPdf,
        supportsVision: newModelCaps.supportsVision,
      });
      setMessage(
        `${result.added} model ditambahkan${result.skipped ? `, ${result.skipped} sudah ada` : ""}.`,
      );
      if (result.added > 0) setModelInput("");
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menambah model.");
    } finally {
      setBusy(false);
    }
  };

  const removeModel = async (id: string) => {
    if (!window.confirm(`Hapus model "${id}" dari katalog?`)) return;
    try {
      const result = await postJson<{ removed: number }>("/api/admin/models", {
        action: "remove",
        id,
      });
      setMessage(`${result.removed} model dihapus dari katalog.`);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus model.");
    }
  };

  const saveKey = async (slot: number) => {
    const key = (keyDrafts[slot] ?? "").trim();
    if (!key) return;
    try {
      await postJson("/api/admin/keys", { action: "set", slot, key });
      setKeyDrafts((current) => ({ ...current, [slot]: "" }));
      setMessage(`Kunci slot ${slot} disimpan (terenkripsi).`);
      loadKeys();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan kunci.");
    }
  };

  const clearKey = async (slot: number) => {
    if (!window.confirm(`Hapus kunci OpenRouter slot ${slot}?`)) return;
    try {
      await postJson("/api/admin/keys", { action: "clear", slot });
      setMessage(`Kunci slot ${slot} dihapus.`);
      loadKeys();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus kunci.");
    }
  };

  const sync = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await postJson<{ synced: number }>("/api/admin/models", { action: "sync" });
      setMessage(`${result.synced} model disinkronkan dari OpenRouter.`);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sinkronisasi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const update = (id: string, patch: Partial<ModelRow>) =>
    setData((current) =>
      current
        ? { ...current, models: current.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) }
        : current,
    );

  const save = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await postJson("/api/admin/models", {
        action: "save",
        models: data.models.map((m) => ({
          id: m.id,
          tier: m.tier,
          enabled: m.enabled,
          supportsPdf: m.supportsPdf,
          supportsVision: m.supportsVision,
        })),
        defaultModel: data.defaultModel,
        quota: data.quota,
        paidAllowed: data.paidAllowed,
      });
      setMessage("Pengaturan model disimpan.");
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (role !== null && !canAccessAdmin(role))
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Halaman admin hanya untuk akun Owner atau Admin yang ditetapkan oleh owner.
            </p>
          </CardContent>
        </Card>
      </div>
    );

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Memuat…</div>;

  const visible = data.models.filter((m) =>
    `${m.id} ${m.name}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const isOwner = role === "owner";

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Admin · Model AI OpenRouter</h1>
          <p className="text-xs text-muted-foreground">
            {data.lastSync
              ? `Sinkron terakhir: ${data.lastSync}`
              : "Belum pernah sinkron dari OpenRouter."}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <>
              <Button variant="outline" disabled={busy} onClick={sync}>
                {busy ? "Memproses…" : "Sinkron dari OpenRouter"}
              </Button>
              <Button disabled={busy} onClick={save}>
                Simpan perubahan
              </Button>
            </>
          )}
          <LogoutButton />
        </div>
      </div>
      {(error || message) && (
        <p className={`text-sm ${error ? "text-destructive" : "text-profit"}`}>
          {error || message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>User & Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Owner membuat akun dan menetapkan role. Admin dan owner bisa melihat seluruh jurnal &
            data member serta menghapus akun. Centang kuning = Owner, centang biru = Admin.
          </p>
          {isOwner && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Input
                placeholder="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              />
              <Input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
              <OptionSelect
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}
              >
                {USER_ROLES.filter((item) => item !== "owner").map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </OptionSelect>
              <Button onClick={createUser} disabled={!newUser.username || !newUser.password}>
                Tambah user
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">Username</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Dibuat</th>
                  {canDeleteAccounts(role ?? "member") && <th className="p-2">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        {item.username}
                        <VerifiedBadge role={item.role} />
                      </span>
                    </td>
                    <td className="p-2">
                      {item.role === "owner" ? (
                        <RoleName role={item.role} />
                      ) : isOwner ? (
                        <OptionSelect
                          value={item.role}
                          onValueChange={(value) => void changeRole(item.id, value)}
                        >
                          {USER_ROLES.filter((r) => r !== "owner").map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </OptionSelect>
                      ) : (
                        <RoleName role={item.role} />
                      )}
                    </td>
                    <td className="p-2">{new Date(item.createdAt).toLocaleDateString()}</td>
                    {canDeleteAccounts(role ?? "member") && (
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={item.role === "owner"}
                          onClick={() => void removeUser(item)}
                        >
                          Hapus akun
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data seluruh member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Admin dan owner bisa membaca jurnal serta data setiap member langsung dari Supabase.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">Member</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Trade</th>
                  <th className="p-2">Profit / Loss</th>
                  <th className="p-2">Running</th>
                  <th className="p-2">Snapshot</th>
                  <th className="p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t">
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        {member.username}
                        <VerifiedBadge role={member.role} />
                      </span>
                    </td>
                    <td className="p-2">
                      <RoleName role={member.role} />
                    </td>
                    <td className="p-2">{member.trades}</td>
                    <td className="p-2">
                      <span className="text-profit">{member.wins}</span> /{" "}
                      <span className="text-loss">{member.losses}</span>
                    </td>
                    <td className="p-2">{member.running}</td>
                    <td className="p-2 text-muted-foreground">
                      {member.snapshotUpdatedAt
                        ? new Date(member.snapshotUpdatedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" onClick={() => void openDetail(member)}>
                        Lihat data
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Data {detail.name} <VerifiedBadge role={detail.data.user.role} />
                </p>
                <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>
                  Tutup
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {detail.data.trades.length} trade · {detail.data.promos.length} postingan · snapshot{" "}
                {detail.data.snapshotUpdatedAt
                  ? new Date(detail.data.snapshotUpdatedAt).toLocaleString()
                  : "tidak ada"}
              </p>
              <div className="max-h-64 overflow-auto rounded border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/80">
                    <tr>
                      <th className="p-2">Tanggal</th>
                      <th className="p-2">Simbol</th>
                      <th className="p-2">Mode</th>
                      <th className="p-2">Side</th>
                      <th className="p-2">PnL</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.trades.map((trade) => (
                      <tr key={String(trade.id)} className="border-t">
                        <td className="p-2">
                          {new Date(String(trade.opened_at)).toLocaleDateString()}
                        </td>
                        <td className="p-2">{String(trade.symbol)}</td>
                        <td className="p-2">{String(trade.mode)}</td>
                        <td className="p-2">{String(trade.side)}</td>
                        <td className="p-2">{String(trade.pnl ?? "—")}</td>
                        <td className="p-2">{String(trade.status)}</td>
                      </tr>
                    ))}
                    {detail.data.trades.length === 0 && (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={6}>
                          Belum ada trade.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Lihat snapshot jurnal lengkap (JSON)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                  {JSON.stringify(detail.data.snapshot ?? {}, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi situs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Hanya owner yang bisa mengubah pengaturan ini. Berlaku untuk seluruh akun.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="site-title">Judul situs</Label>
                <Input
                  id="site-title"
                  value={site.siteTitle}
                  maxLength={120}
                  onChange={(e) => setSite({ ...site, siteTitle: e.target.value })}
                  placeholder="Trade Jurnal by Artian Capital Group"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="discord-url">Link Discord (tombol mengambang)</Label>
                <Input
                  id="discord-url"
                  type="url"
                  value={site.discordUrl}
                  onChange={(e) => setSite({ ...site, discordUrl: e.target.value })}
                  placeholder="https://discord.gg/…"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={site.showFloatingDiscord}
                onChange={(e) => setSite({ ...site, showFloatingDiscord: e.target.checked })}
              />
              Tampilkan tombol Discord mengambang
            </label>
            <Button disabled={busy} onClick={() => void saveSite()}>
              Simpan konfigurasi situs
            </Button>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Input model OpenRouter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Satu model ID per baris (bisa juga dipisah koma). Suffix <code>:free</code>,{" "}
                <code>/free</code>, atau <code>-free</code> otomatis ditandai Free. Saat{" "}
                <b>Sinkron dari OpenRouter</b>, kemampuan Vision/File deteksi otomatis dari{" "}
                <code>input_modalities</code>. Model input manual bisa ditandai di bawah. Hanya
                owner yang bisa menambah atau menghapus model.
              </p>
              <textarea
                rows={4}
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder={MODEL_EXAMPLES}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={newModelCaps.supportsVision}
                    onChange={(e) =>
                      setNewModelCaps({ ...newModelCaps, supportsVision: e.target.checked })
                    }
                  />
                  Vision / gambar
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={newModelCaps.supportsPdf}
                    onChange={(e) =>
                      setNewModelCaps({ ...newModelCaps, supportsPdf: e.target.checked })
                    }
                  />
                  File / PDF
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button disabled={busy || !modelInput.trim()} onClick={() => void addModels()}>
                  Tambah model ke katalog
                </Button>
                <p className="text-xs text-muted-foreground">
                  Contoh: {MODEL_EXAMPLES.split("\n")[0]}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kunci API OpenRouter · 10 slot fallback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Kunci disimpan terenkripsi di Supabase dan hanya dipakai di server. Kosongkan slot
                untuk menghapusnya. Urutan fallback: kunci pribadi pengguna → slot 1–10 → kunci di
                environment. Admin tidak bisa melihat atau mengubah kunci ini.
              </p>
              <div className="space-y-2">
                {keySlots.map((slot) => (
                  <div
                    key={slot.slot}
                    className="grid items-center gap-2 sm:grid-cols-[3rem_1fr_1fr_auto_auto]"
                  >
                    <span className="text-xs text-muted-foreground">#{slot.slot}</span>
                    <span
                      className="truncate text-xs text-muted-foreground"
                      title={slot.masked ?? ""}
                    >
                      {slot.masked ?? "Kosong"}
                    </span>
                    <Input
                      type="password"
                      value={keyDrafts[slot.slot] ?? ""}
                      onChange={(e) =>
                        setKeyDrafts((current) => ({ ...current, [slot.slot]: e.target.value }))
                      }
                      placeholder={slot.configured ? "Ganti kunci…" : "sk-or-…"}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      disabled={!(keyDrafts[slot.slot] ?? "").trim()}
                      onClick={() => void saveKey(slot.slot)}
                    >
                      {slot.configured ? "Ubah" : "Simpan"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!slot.configured}
                      onClick={() => void clearKey(slot.slot)}
                    >
                      Hapus
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!isOwner && (
        <p className="rounded-md border p-3 text-xs text-muted-foreground">
          Katalog model hanya bisa dilihat oleh Admin. Penambahan model, sinkronisasi, kuota, dan
          kunci OpenRouter hanya bisa diubah oleh Owner.
        </p>
      )}

      {isOwner && (
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="default-model">Model default</Label>
              <OptionSelect
                id="default-model"
                value={data.defaultModel}
                onValueChange={(value) => setData({ ...data, defaultModel: value })}
              >
                {data.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </OptionSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="quota">Kuota AI / hari per pengguna</Label>
              <Input
                id="quota"
                type="number"
                min={1}
                max={1000}
                value={data.quota}
                onChange={(e) => setData({ ...data, quota: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paid-allowed">Model Paid untuk kunci global</Label>
              <OptionSelect
                id="paid-allowed"
                value={data.paidAllowed ? "yes" : "no"}
                onValueChange={(value) => setData({ ...data, paidAllowed: value === "yes" })}
              >
                <option value="no">Tidak diizinkan</option>
                <option value="yes">Diizinkan</option>
              </OptionSelect>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Katalog model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Cari model…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="max-h-[560px] overflow-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  <th className="p-2">Model</th>
                  <th className="p-2">Tier</th>
                  <th className="p-2">Vision</th>
                  <th className="p-2">File / PDF</th>
                  <th className="p-2">Aktif</th>
                  <th className="p-2">Sumber</th>
                  {isOwner && <th className="p-2">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-muted-foreground">{m.id}</div>
                    </td>
                    <td className="p-2">
                      {isOwner ? (
                        <OptionSelect
                          value={m.tier}
                          onValueChange={(value) =>
                            update(m.id, { tier: value as "free" | "paid" })
                          }
                        >
                          <option value="free">Free</option>
                          <option value="paid">Paid</option>
                        </OptionSelect>
                      ) : (
                        m.tier
                      )}
                    </td>
                    <td className="p-2">
                      {isOwner ? (
                        <input
                          type="checkbox"
                          checked={Boolean(m.supportsVision)}
                          onChange={(e) => update(m.id, { supportsVision: e.target.checked })}
                        />
                      ) : m.supportsVision ? (
                        "Ya"
                      ) : (
                        "Tidak"
                      )}
                    </td>
                    <td className="p-2">
                      {isOwner ? (
                        <input
                          type="checkbox"
                          checked={Boolean(m.supportsPdf)}
                          onChange={(e) => update(m.id, { supportsPdf: e.target.checked })}
                        />
                      ) : m.supportsPdf ? (
                        "Ya"
                      ) : (
                        "Tidak"
                      )}
                    </td>
                    <td className="p-2">
                      {isOwner ? (
                        <input
                          type="checkbox"
                          checked={Boolean(m.enabled)}
                          onChange={(e) => update(m.id, { enabled: e.target.checked })}
                        />
                      ) : m.enabled ? (
                        "Ya"
                      ) : (
                        "Tidak"
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">{m.source}</td>
                    {isOwner && (
                      <td className="p-2">
                        <Button size="sm" variant="ghost" onClick={() => void removeModel(m.id)}>
                          Hapus
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Perubahan tier/PDF/aktif akan disimpan sebagai override admin dan tidak ditimpa saat
            sinkron berikutnya.
          </p>
        </CardContent>
      </Card>
      <PoweredByLuxAlgo className="text-center" />
    </div>
  );
}
