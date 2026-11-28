"use client";

import { useEffect, useState } from "react";
import { useApi, postJson } from "@/lib/use-api";
import type { AiSettingsPayload } from "@/lib/ai-settings";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";

const capabilityLabel = (model: { supportsVision?: boolean; supportsPdf?: boolean }): string => {
  const tags = [
    model.supportsVision ? "Vision" : null,
    model.supportsPdf ? "File/PDF" : null,
  ].filter(Boolean);
  return tags.length ? ` · ${tags.join(" + ")}` : "";
};

export function AiSettings() {
  const { data, error, loading, refresh } = useApi<AiSettingsPayload>("/api/settings");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (data) setModel(data.model);
  }, [data]);

  const save = async (remove = false) => {
    setBusy(true);
    setFailure("");
    setSaved("");
    try {
      await postJson(
        "/api/settings",
        remove
          ? { openrouterKey: null }
          : { aiModel: model, ...(apiKey.trim() ? { openrouterKey: apiKey.trim() } : {}) },
        "PATCH",
      );
      setApiKey("");
      setSaved(remove ? "Kunci OpenRouter dihapus." : "Pengaturan AI disimpan.");
      refresh();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Gagal menyimpan pengaturan AI.");
    } finally {
      setBusy(false);
    }
  };

  const freeModels = data?.models.filter((m) => m.tier === "free") ?? [];
  const paidModels = data?.models.filter((m) => m.tier === "paid") ?? [];
  const ownKey = data?.keySource === "saved";

  return (
    <Card id="ai-settings" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>AI — OpenRouter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ringkasan sesi, kritik trade, “ask your journal”, dan parsing pernyataan memakai
          OpenRouter. Kunci server dipakai untuk semua pengguna; Anda juga bisa memakai kunci
          sendiri (BYOK).
        </p>
        {data && (
          <div className="rounded-md border p-2 text-xs text-muted-foreground">
            <div>Status: {data.configured ? "Terkoneksi" : "Belum ada kunci"}</div>
            <div>
              Sumber kunci:{" "}
              {data.keySource === "environment"
                ? "server (global)"
                : ownKey
                  ? "kunci Anda"
                  : "tidak ada"}
            </div>
            <div>
              Kuota hari ini: {data.quota.used}/{data.quota.limit} permintaan
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="ai-model">Model</Label>
          <OptionSelect
            id="ai-model"
            value={model}
            disabled={busy || loading || !data}
            onValueChange={(value) => {
              setModel(value);
              setSaved("");
            }}
          >
            {freeModels.map((m) => (
              <option key={m.id} value={m.id}>
                [Free] {m.name}
                {capabilityLabel(m)}
              </option>
            ))}
            {paidModels.map((m) => (
              <option key={m.id} value={m.id}>
                [Paid] {m.name}
                {capabilityLabel(m)}
              </option>
            ))}
          </OptionSelect>
          <p className="text-xs text-muted-foreground">
            Model Paid hanya bisa dipakai bila admin mengizinkan atau Anda memakai kunci sendiri.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-api-key">Kunci OpenRouter sendiri (opsional)</Label>
          <Input
            id="ai-api-key"
            type="password"
            value={apiKey}
            disabled={busy || loading}
            placeholder={ownKey ? "Kunci tersimpan — kosongkan untuk mengganti" : "sk-or-…"}
            onChange={(event) => {
              setApiKey(event.target.value);
              setSaved("");
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Kunci disimpan terenkripsi hanya untuk akun Anda dan dikirim langsung ke OpenRouter.
          </p>
        </div>
        {(error || failure) && (
          <p role="alert" className="text-xs text-destructive">
            {failure || error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-xs text-profit">
            {saved}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || loading || !model} onClick={() => save()}>
            {busy ? "Menyimpan…" : "Simpan pengaturan AI"}
          </Button>
          {ownKey && (
            <Button variant="outline" disabled={busy} onClick={() => save(true)}>
              Hapus kunci saya
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
