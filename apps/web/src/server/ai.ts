import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, RetryError, generateText } from "ai";
import { eq } from "drizzle-orm";
import { systemDb } from "@/db";
import { models } from "@/db/system-schema";
import {
  aiConfigured,
  consumeQuota,
  getAiKey,
  getAiModel,
  getOpenRouterBaseUrl,
  getSetting,
  isPaidAllowed,
} from "./settings";

/**
 * Reflection layer. Every request goes from this server to OpenRouter using
 * the OpenAI-compatible Chat Completions API. The key never reaches the browser.
 */
export const aiConfiguredForUser = (): boolean => aiConfigured();

const SYSTEM = `You are the reflection layer of a trader's journal.
You see only the trader's own recorded data — trades, stats, and notes. Ground every
statement in those numbers; never invent trades, prices, or market context you weren't given.
Be direct and specific like a good trading coach: name the behavior, cite the numbers,
say what to keep and what to fix. No platitudes, no disclaimers about trading being risky —
the trader knows. Keep it tight.`;

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

export const runAi = async (prompt: string, maxOutputTokens = 1200): Promise<string> => {
  const key = getAiKey();
  if (!key) throw new Error("AI is not configured — add an OpenRouter key in Settings.");

  const modelId = getAiModel();
  const modelRow = systemDb.select().from(models).where(eq(models.id, modelId)).get();
  const hasOwnKey = Boolean(getSetting("openrouterKeyEnc"));
  if (modelRow?.tier === "paid" && !isPaidAllowed() && !hasOwnKey) {
    throw new Error(
      "Model berbayar tidak diizinkan dengan kunci global. Pilih model Free atau tambahkan kunci OpenRouter Anda sendiri di Settings.",
    );
  }

  consumeQuota();
  try {
    const result = await generateText({
      model: openrouter(key)(modelId),
      system: SYSTEM,
      prompt,
      maxOutputTokens,
    });
    if (!result.text.trim()) throw new Error("AI returned no text. Check the model or try again.");
    return result.text;
  } catch (error) {
    if (RetryError.isInstance(error)) error = error.lastError;
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 401 || error.statusCode === 403)
        throw new Error("AI authentication_error: periksa kunci OpenRouter Anda di Settings.");
      if (error.statusCode === 402 || /credit|billing|quota/i.test(error.message))
        throw new Error("AI billing: saldo OpenRouter habis atau kuota terlampaui.");
      if (error.statusCode === 429 || error.statusCode === 529)
        throw new Error("AI rate limit: terlalu banyak permintaan, coba lagi sebentar.");
      if (
        error.statusCode === 404 ||
        /model.*(?:not found|does not exist|access)/i.test(error.message)
      )
        throw new Error("AI model unavailable: model tidak tersedia untuk akun OpenRouter Anda.");
      if (error.statusCode === undefined)
        throw new Error("AI server unreachable: periksa koneksi ke OpenRouter.");
    }
    throw new Error("AI request failed. Coba lagi sebentar atau periksa Settings.");
  }
};

/** A user-supplied key unlocks paid models even when the global key is restricted. */
