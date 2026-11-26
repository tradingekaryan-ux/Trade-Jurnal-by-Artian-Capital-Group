// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AiSettingsPayload } from "../src/lib/ai-settings";

const state = vi.hoisted(() => ({
  post: vi.fn(),
  refresh: vi.fn(),
  data: undefined as unknown,
}));
vi.mock("@/lib/use-api", () => ({
  postJson: (...args: unknown[]) => state.post(...args),
  useApi: () => ({ data: state.data, error: null, loading: false, refresh: state.refresh }),
}));
const { AiSettings } = await import("../src/components/ai-settings");

let container: HTMLDivElement;
let root: Root;

const payload = (): AiSettingsPayload => ({
  configured: true,
  keySource: "environment",
  model: "openai/gpt-4.1-mini",
  models: [
    {
      id: "openai/gpt-4.1-mini",
      name: "GPT-4.1 Mini",
      tier: "free",
      contextLength: 128000,
      supportsPdf: true,
      enabled: true,
      isDefault: true,
      source: "openrouter",
    },
    {
      id: "anthropic/claude-sonnet-4.5",
      name: "Claude Sonnet",
      tier: "paid",
      contextLength: 200000,
      supportsPdf: true,
      enabled: true,
      isDefault: false,
      source: "openrouter",
    },
  ],
  defaultModel: "openai/gpt-4.1-mini",
  quota: { limit: 10, used: 3, day: "2026-01-01" },
  paidAllowed: false,
  baseUrl: "https://openrouter.ai/api/v1",
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.post.mockReset().mockResolvedValue({ saved: true });
  state.refresh.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const render = async (data: AiSettingsPayload) => {
  state.data = data;
  await act(async () => root.render(createElement(AiSettings)));
};

it("shows free and paid model groups and the daily quota", async () => {
  await render(payload());
  expect(container.textContent).toContain("3/10");
  expect(container.textContent).toContain("GPT-4.1 Mini");
  expect(container.querySelector("#ai-model")).not.toBeNull();
});

it("posts the selected model when saving", async () => {
  await render(payload());
  const save = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Simpan pengaturan"),
  );
  await act(async () => save?.click());
  expect(state.post).toHaveBeenCalledWith(
    "/api/settings",
    expect.objectContaining({ aiModel: "openai/gpt-4.1-mini" }),
    "PATCH",
  );
});
