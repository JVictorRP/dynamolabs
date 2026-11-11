/**
 * Preços da API da Anthropic em USD por 1M de tokens (conferidos em 2026-11-10).
 * Único lugar do código com preços: a simulação de custos e o teto mensal leem daqui.
 */
export type ModelId = "claude-haiku-5-5" | "claude-sonnet-5-5";

export const PRICES: Record<ModelId, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export const MODELS = Object.keys(PRICES) as ModelId[];
export const isModelId = (v: string): v is ModelId => v in PRICES;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costUsd(model: ModelId, usage: Usage): number {
  const p = PRICES[model];
  return (
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}
