import { expect, it } from "vitest";
import { capabilitiesFor } from "../src/lib/model-capabilities";

it("detects vision and file/PDF from OpenRouter input modalities", () => {
  expect(
    capabilitiesFor({
      id: "google/gemini-4-neon",
      architecture: { input_modalities: ["audio", "file", "image", "text", "video"] },
    }),
  ).toEqual({ supportsVision: true, supportsPdf: true });

  expect(
    capabilitiesFor({
      id: "anthropic/claude-fable-5.2",
      architecture: { input_modalities: ["text", "image", "file"] },
    }),
  ).toEqual({ supportsVision: true, supportsPdf: true });

  expect(
    capabilitiesFor({
      id: "openrouter/free",
      architecture: { input_modalities: ["text"] },
    }),
  ).toEqual({ supportsVision: false, supportsPdf: false });

  expect(
    capabilitiesFor({
      id: "fish-audio/s2.1-pro-free:free",
      architecture: { input_modalities: ["audio", "text"] },
    }),
  ).toEqual({ supportsVision: false, supportsPdf: false });
});

it("falls back to a name heuristic when OpenRouter omits modalities", () => {
  expect(capabilitiesFor({ id: "google/gemini-4-neon:free" })).toEqual({
    supportsVision: true,
    supportsPdf: true,
  });
  expect(capabilitiesFor({ id: "nvidia/nemotron-3-nano:free" })).toEqual({
    supportsVision: false,
    supportsPdf: false,
  });
});
