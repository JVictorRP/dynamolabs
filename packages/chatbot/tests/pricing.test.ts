import { describe, expect, it } from "vitest";
import { costUsd } from "../src/pricing";

const M = 1_000_000;

describe("costUsd", () => {
  it("prices Haiku 5.5 input and output", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: M, output_tokens: 0 })).toBeCloseTo(0.1, 10);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 0, output_tokens: M })).toBeCloseTo(0.5, 10);
  });
  it("prices cache reads and writes", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: M })).toBeCloseTo(0.2, 10);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: M })).toBeCloseTo(0.125, 10);
  });
  it("treats null fields as zero", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: null, cache_creation_input_tokens: null })).toBeCloseTo(0.002 + 0.001, 10);
  });
});
