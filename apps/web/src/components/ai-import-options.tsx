"use client";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Settings2, X } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { HelpHint } from "./ui/tooltip";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";
import type { AiSettingsPayload } from "@/lib/ai-settings";
import { AI_IMPORT_HELP, type AiImportOptions as Options } from "@/lib/ai-import";

export function AiImportOptions({
  enabled,
  onEnabledChange,
  value,
  onChange,
  settings,
  disabled,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  value: Options;
  onChange: (value: Options) => void;
  settings?: AiSettingsPayload;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open && enabled} onOpenChange={setOpen}>
      <div className="flex shrink-0 items-center gap-1.5">
        <Checkbox
          id="ai-import-enabled"
          checked={enabled}
          disabled={disabled}
          onCheckedChange={(checked) => {
            onEnabledChange(checked === true);
            setOpen(checked === true);
          }}
        />
        <Label
          htmlFor="ai-import-enabled"
          className="flex cursor-pointer items-center gap-1.5 text-xs font-normal text-muted-foreground"
        >
          Parse dengan AI
        </Label>
        <HelpHint heading="Parsing pernyataan dengan AI">{AI_IMPORT_HELP}</HelpHint>
        {enabled && (
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Pengaturan parsing AI"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Settings2 className="size-3.5" />
            </button>
          </Popover.Trigger>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Pengaturan parsing AI"
          className="z-50 w-[360px] max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Pengaturan parsing AI</span>
            <Popover.Close
              aria-label="Tutup"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="size-4" />
            </Popover.Close>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="import-ai-model">Model OpenRouter</Label>
              <OptionSelect
                id="import-ai-model"
                value={value.model}
                disabled={disabled}
                onValueChange={(model) => onChange({ ...value, model })}
              >
                {(settings?.models ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.tier === "free" ? "[Free] " : "[Paid] "}
                    {model.name}
                  </option>
                ))}
              </OptionSelect>
              <p className="text-xs text-muted-foreground">
                Pilih model yang mendukung PDF bila mengunggah PDF.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="import-ai-key">Kunci OpenRouter (opsional)</Label>
              <Input
                id="import-ai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={value.apiKey ?? ""}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
                placeholder={
                  settings?.configured
                    ? "Kosongkan untuk memakai kunci tersimpan"
                    : "Masukkan kunci"
                }
              />
              <p className="text-xs text-muted-foreground">
                Kunci yang dimasukkan hanya dipakai untuk unggahan ini. Kunci tersimpan diatur di{" "}
                <a href="/settings#ai-settings" className="underline">
                  Settings
                </a>
                .
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Kuota AI hari ini: {settings?.quota?.used ?? 0}/{settings?.quota?.limit ?? 10}. File
              dikirim ke OpenRouter; tinjau hasil ekstraksi sebelum mengimpor.
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
