export type ModelVariant = {
  modelId: string;
  apiType: "completions" | "responses" | "messages";
  useReasoning?: boolean;
};

export type ModelConfig = {
  id: string;
  name: string;
  fast: ModelVariant;
  thinking: ModelVariant;
};

export const MODELS: ModelConfig[] = [
  {
    id: "anuma",
    name: "Anuma",
    fast: { modelId: "cerebras/qwen-3-235b-a22b-instruct-2507", apiType: "completions" },
    thinking: { modelId: "fireworks/accounts/fireworks/models/qwen3-235b-a22b-thinking-2507", apiType: "completions" },
  },
  {
    id: "gpt",
    name: "GPT 5.2",
    fast: { modelId: "openai/gpt-5.2", apiType: "responses" },
    thinking: { modelId: "openai/gpt-5.2", apiType: "responses", useReasoning: true },
  },
  {
    id: "claude",
    name: "Claude Opus 4.5",
    fast: { modelId: "anthropic/claude-opus-4-5-20251101", apiType: "messages" },
    thinking: { modelId: "anthropic/claude-opus-4-5-20251101", apiType: "messages", useReasoning: true },
  },
  {
    id: "grok",
    name: "Grok 4.1",
    fast: { modelId: "grok/grok-4-1-fast-non-reasoning", apiType: "completions" },
    thinking: { modelId: "grok/grok-4-1-fast-reasoning", apiType: "completions" },
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

// Helper to get the resolved model config based on thinking toggle
export function getModelConfig(modelId: string, thinkingEnabled: boolean): ModelVariant | null {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) return null;
  return thinkingEnabled ? model.thinking : model.fast;
}
