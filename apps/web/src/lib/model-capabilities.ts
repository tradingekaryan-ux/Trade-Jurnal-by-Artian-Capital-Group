/** Capability flags derived from OpenRouter's model metadata. */
export interface ModelCapabilities {
  supportsVision: boolean;
  supportsPdf: boolean;
}

export interface OpenRouterModelMeta {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

/**
 * OpenRouter reports real input modalities per model (`architecture.input_modalities`),
 * so vision/file support comes from data rather than name guessing. When the
 * field is absent (older payloads or hand-added models) a conservative name
 * heuristic is used instead.
 */
export const capabilitiesFor = (model: OpenRouterModelMeta): ModelCapabilities => {
  const input = (model.architecture?.input_modalities ?? []).map((value) => value.toLowerCase());
  if (input.length > 0) {
    return {
      supportsVision: input.some((value) => value === "image" || value === "video"),
      supportsPdf: input.includes("file"),
    };
  }
  const vision = /vision|vl\b|omni|image|gpt-4|gemini|claude/i.test(model.id);
  return { supportsVision: vision, supportsPdf: /gpt-4|gemini|claude/i.test(model.id) };
};
