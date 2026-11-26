import { APICallError, RetryError } from "ai";
import { getAiKeys } from "./settings";

/** Errors that mean "this key cannot serve the request, try the next one". */
const shouldTryNextKey = (error: unknown): boolean => {
  const candidate = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(candidate)) return false;
  const status = candidate.statusCode;
  return (
    status === 401 ||
    status === 403 ||
    status === 402 ||
    status === 429 ||
    status === 529 ||
    status === undefined
  );
};

/**
 * Run an OpenRouter request with automatic key fallback. Keys are supplied by
 * the server only; no key is ever returned to the client. If every key fails,
 * the last error is thrown.
 */
export const withKeyFallback = async <T>(
  run: (key: string) => Promise<T>,
  keys: string[] = getAiKeys(),
): Promise<T> => {
  if (keys.length === 0)
    throw new Error("AI is not configured — tambahkan kunci OpenRouter di server atau Settings.");
  let lastError: unknown;
  for (const key of keys) {
    try {
      return await run(key);
    } catch (error) {
      lastError = error;
      if (!shouldTryNextKey(error)) throw error;
    }
  }
  throw lastError;
};
