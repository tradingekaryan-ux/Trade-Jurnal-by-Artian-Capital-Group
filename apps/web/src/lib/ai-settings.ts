export type AiModelTier = "free" | "paid";

export interface AiModel {
  id: string;
  name: string;
  tier: AiModelTier;
  contextLength: number | null;
  /** Model menerima gambar/video (vision). */
  supportsVision: boolean;
  /** Model menerima lampiran berkas, termasuk PDF. */
  supportsPdf: boolean;
  enabled: boolean;
  isDefault: boolean;
  source: "openrouter" | "admin";
}

export interface AiQuota {
  limit: number;
  used: number;
  day: string;
}

export interface AiSettingsPayload {
  configured: boolean;
  keySource: "environment" | "saved" | "none";
  model: string;
  models: AiModel[];
  defaultModel: string;
  quota: AiQuota;
  paidAllowed: boolean;
  baseUrl: string;
}

export const DEFAULT_AI_QUOTA = 10;
export const DEFAULT_MODEL = "openai/gpt-4.1-mini";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const isAiModelTier = (value: unknown): value is AiModelTier =>
  value === "free" || value === "paid";
