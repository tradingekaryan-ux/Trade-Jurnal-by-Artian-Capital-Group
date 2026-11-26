"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { PoweredByLuxAlgo } from "@/components/powered-by-luxalgo";
import { LogoutButton } from "@/components/user-menu";
import { postJson } from "@/lib/use-api";
import { ROLE_LABELS, USER_ROLES, canAccessAdmin, isUserRole, type UserRole } from "@/lib/roles";

interface ModelRow {
  id: string;
  name: string;
  tier: "free" | "paid";
  contextLength: number | null;
  supportsPdf: boolean;
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

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
  useEffect(() => {
    if (role === "owner") loadUsers();
  }, [role]);

  const createUser = async () => {
    try {
      await postJson("/api/admin/users", newUser);
      setNewUser({ username: "", password: "", role: "member" });
      setMessage("User berhasil dibuat.");
      loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat user.");
    }
  };

  const changeRole = async (id: string, next: string) => {
    try {
      await postJson("/api/admin/users", { id, role: next }, "PATCH");
      setMessage("Role diperbarui.");
      loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengubah role.");
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
              Halaman admin hanya untuk akun dengan role Owner atau Admin yang ditetapkan oleh
              owner.
            </p>
          </CardContent>
        </Card>
      </div>
    );

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Memuat…</div>;

  const visible = data.models.filter((m) =>
    `${m.id} ${m.name}`.toLowerCase().includes(filter.toLowerCase()),
  );

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
          <Button variant="outline" disabled={busy} onClick={sync}>
            {busy ? "Memproses…" : "Sinkron dari OpenRouter"}
          </Button>
          <Button disabled={busy} onClick={save}>
            Simpan perubahan
          </Button>
          <LogoutButton />
        </div>
      </div>
      {(error || message) && (
        <p className={`text-sm ${error ? "text-destructive" : "text-profit"}`}>
          {error || message}
        </p>
      )}

      {role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle>User & Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Hanya owner yang bisa membuat akun dan memberi role. Owner bawaan dibuat otomatis saat
              pertama kali aplikasi berjalan.
            </p>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2">Username</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">{item.username}</td>
                      <td className="p-2">
                        {item.role === "owner" ? (
                          ROLE_LABELS.owner
                        ) : (
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
                        )}
                      </td>
                      <td className="p-2">{new Date(item.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <th className="p-2">PDF</th>
                  <th className="p-2">Aktif</th>
                  <th className="p-2">Sumber</th>
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
                      <OptionSelect
                        value={m.tier}
                        onValueChange={(value) => update(m.id, { tier: value as "free" | "paid" })}
                      >
                        <option value="free">Free</option>
                        <option value="paid">Paid</option>
                      </OptionSelect>
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={m.supportsPdf}
                        onChange={(e) => update(m.id, { supportsPdf: e.target.checked })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={(e) => update(m.id, { enabled: e.target.checked })}
                      />
                    </td>
                    <td className="p-2 text-muted-foreground">{m.source}</td>
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
