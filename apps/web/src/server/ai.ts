import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, RetryError, generateText } from "ai";
import {
  aiConfigured,
  consumeQuota,
  getAiKeys,
  getAiModel,
  getOpenRouterBaseUrl,
  getSetting,
  isPaidAllowed,
} from "./settings";
import { withKeyFallback } from "./openrouter";
import { sql } from "./pg";

/**
 * Reflection layer. Every request goes from this server to OpenRouter using
 * the OpenAI-compatible Chat Completions API. The key never reaches the browser.
 */
export const aiConfiguredForUser = async (): Promise<boolean> => aiConfigured();

const SYSTEM = `You are the reflection layer of a trader's journal.
You see only the trader's own recorded data — trades, stats, and notes. Ground every
statement in those numbers; never invent trades, prices, or market context you weren't given.
Be direct and specific like a good trading coach: name the behavior, cite the numbers,
say what to keep and what to fix. No platitudes or disclaimers about trading being risky.
Keep it tight.`;

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

const openrouter = (apiKey: string) =>
  createOpenAICompatible({
    name: "openrouter",
    baseURL: getOpenRouterBaseUrl(),
    apiKey,
    headers: {
      "HTTP-Referer": siteUrl,
      "X-Title": "Trade Jurnal by Artian Capital Group",
    },
  });

/** Validate model permissions and consume one daily quota request. */
const prepareAi = async (requestedModel?: string): Promise<string> => {
  if ((await getAiKeys()).length === 0)
    throw new Error("AI belum dikonfigurasi — tambahkan kunci OpenRouter di Settings.");
  const modelId = requestedModel ?? (await getAiModel());
  const found = await sql`select tier from models where id = ${modelId} limit 1`;
  const hasOwnKey = Boolean(getSetting("openrouterKeyEnc"));
  if (found[0]?.tier === "paid" && !(await isPaidAllowed()) && !hasOwnKey)
    throw new Error(
      "Model berbayar tidak diizinkan dengan kunci global. Pilih model Free atau tambahkan kunci OpenRouter Anda sendiri di Settings.",
    );
  await consumeQuota();
  return modelId;
};

const translateError = (error: unknown): never => {
  let candidate = error;
  if (RetryError.isInstance(candidate)) candidate = candidate.lastError;
  if (APICallError.isInstance(candidate)) {
    if (candidate.statusCode === 401 || candidate.statusCode === 403)
      throw new Error("AI authentication_error: periksa kunci OpenRouter Anda di Settings.");
    if (candidate.statusCode === 402 || /credit|billing|quota/i.test(candidate.message))
      throw new Error("AI billing: saldo OpenRouter habis atau kuota terlampaui.");
    if (candidate.statusCode === 429 || candidate.statusCode === 529)
      throw new Error("AI rate limit: terlalu banyak permintaan, coba lagi sebentar.");
    if (
      candidate.statusCode === 404 ||
      /model.*(?:not found|does not exist|access)/i.test(candidate.message)
    )
      throw new Error("AI model unavailable: model tidak tersedia untuk akun OpenRouter Anda.");
    if (candidate.statusCode === undefined)
      throw new Error("AI server unreachable: periksa koneksi ke OpenRouter.");
  }
  console.error("[ai] request failed:", candidate instanceof Error ? candidate.message : candidate);
  throw new Error("AI request failed. Coba lagi sebentar atau periksa Settings.");
};

const finish = async (text: string): Promise<string> => {
  if (!text.trim()) throw new Error("AI returned no text. Check the model or try again.");
  return text;
};

export const runAi = async (
  prompt: string,
  maxOutputTokens = 2000,
  modelId?: string,
): Promise<string> => {
  const model = await prepareAi(modelId);
  try {
    return await withKeyFallback(async (key) => {
      const result = await generateText({
        model: openrouter(key)(model),
        system: SYSTEM,
        prompt,
        maxOutputTokens,
      });
      return await finish(result.text);
    });
  } catch (error) {
    return translateError(error);
  }
};

export interface AiImage {
  /** Base64-encoded bytes, without a data-URL prefix. */
  data: string;
  mediaType: string;
}

/** Same reflection layer, with chart screenshots attached for vision-capable models. */
export const runAiWithImages = async (
  prompt: string,
  images: AiImage[],
  maxOutputTokens = 2000,
  modelId?: string,
): Promise<string> => {
  const model = await prepareAi(modelId);
  try {
    return await withKeyFallback(async (key) => {
      const result = await generateText({
        model: openrouter(key)(model),
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map((image) => ({
                type: "image" as const,
                image: image.data,
                mediaType: image.mediaType,
              })),
            ],
          },
        ],
        maxOutputTokens,
      });
      return await finish(result.text);
    });
  } catch (error) {
    return translateError(error);
  }
};

/** Pick the first enabled vision-capable model when screenshots are attached. */
export const pickVisionModel = async (preferred: string): Promise<string | null> => {
  const rows = await sql`select id, supports_vision, tier from models where enabled = true`;
  const preferredRow = rows.find((row) => row.id === preferred);
  if (preferredRow?.supports_vision) return preferred;
  const free = rows.find((row) => row.supports_vision && row.tier === "free");
  return free?.id ?? rows.find((row) => row.supports_vision)?.id ?? null;
};
