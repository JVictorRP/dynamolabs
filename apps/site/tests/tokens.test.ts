import { describe, expect, it } from "vitest";
import tokens from "../design/tokens.json";
import { buildTokensCss } from "../scripts/build-tokens.mjs";

describe("buildTokensCss", () => {
  const css = buildTokensCss(tokens);

  it("emits the brand colors inside a Tailwind @theme block", () => {
    expect(css).toContain("@theme {");
    expect(css).toContain("--color-void: #0a0a0a;");
    expect(css).toContain("--color-amber: #ffb339;");
    expect(css).toContain("--color-teal: #17c6c1;");
    expect(css).toContain("--color-graphite: #353535;");
    expect(css).toContain("--color-mist: #e5f3f5;");
  });

  it("skips the legacy blue grading tokens the design system forbids", () => {
    expect(css).not.toContain("photo-indigo");
    expect(css).not.toContain("photo-azure");
    expect(css).not.toContain("neon-cyan");
  });

  it("skips themed and alias tokens (they are not plain values)", () => {
    expect(css).not.toContain("--color-surface");
    expect(css).not.toContain("--color-accent");
  });
});
