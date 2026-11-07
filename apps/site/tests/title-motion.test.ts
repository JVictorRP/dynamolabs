import { describe, expect, it } from "vitest";
import { heroTitleState, s2TitleState } from "../src/lib/choreo/title-motion";

const steps = (from: number, to: number, n: number) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe("heroTitleState (the hero folds away while the camera descends, 25–45%)", () => {
  it("is fully visible and flat until 25%", () => {
    expect(heroTitleState(0.1)).toMatchObject({ opacity: 1, z: 0, y: 0 });
    expect(heroTitleState(0.1).rotX).toBeCloseTo(0, 6);
    expect(heroTitleState(0.25).opacity).toBe(1);
  });

  it("is gone at 45%, rotated to the maximum fold and receded", () => {
    const end = heroTitleState(0.45);
    expect(end.opacity).toBe(0);
    expect(end.rotX).toBe(-1.2);
    expect(end.z).toBeLessThan(0);
  });

  it("fades monotonically between 25% and 45%", () => {
    const opacities = steps(0.25, 0.45, 20).map((p) => heroTitleState(p).opacity);
    opacities.slice(1).forEach((o, i) => expect(o).toBeLessThanOrEqual(opacities[i]));
  });

  it("stays gone for the rest of the stage", () => {
    expect(heroTitleState(0.9).opacity).toBe(0);
  });
});

describe("s2TitleState (rises from depth on the right, 45–60%, leaves in the breather, 80–88%)", () => {
  it("is invisible before section 2 starts", () => {
    expect(s2TitleState(0.44).opacity).toBe(0);
  });

  it("starts deep in the scene and arrives at z = 0", () => {
    expect(s2TitleState(0.45).z).toBe(-2);
    expect(s2TitleState(0.6).z).toBeCloseTo(0, 6);
  });

  it("holds the translucency ceiling of 0.85 while it is on screen, and never exceeds it", () => {
    expect(s2TitleState(0.7).opacity).toBe(0.85);
    for (const p of steps(0, 1, 100)) expect(s2TitleState(p).opacity).toBeLessThanOrEqual(0.85);
  });

  it("is gone in the breather (no text at 95%)", () => {
    expect(s2TitleState(0.95).opacity).toBe(0);
    expect(s2TitleState(1).opacity).toBe(0);
  });
});
