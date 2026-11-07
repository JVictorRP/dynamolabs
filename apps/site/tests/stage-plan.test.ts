import { describe, expect, it } from "vitest";
import { planDraw } from "../src/lib/stage/plan-draw";
import type { FrameManifest } from "../src/lib/frames/manifest";

const manifest: FrameManifest = {
  id: "v1",
  frames: 119,
  tiers: { desktop: { width: 1920, height: 1072 }, mobile: { width: 960, height: 536 } },
  pathPattern: "/frames/v1/{tier}/{n}.webp",
  focus: [{ at: 0, x: 0, y: 0.5 }, { at: 1, x: 1, y: 0.5 }],
};

describe("planDraw", () => {
  it("picks the frame pair for the progress (0.5 of 119 frames is exactly frame 59)", () => {
    const plan = planDraw(manifest, "desktop", 0.5, { w: 390, h: 844 });
    expect(plan.index).toBe(59);
    expect(plan.next).toBe(60);
    expect(plan.mix).toBe(0);
  });

  it("crops a portrait window centered on the interpolated focus", () => {
    const { crop } = planDraw(manifest, "desktop", 0.5, { w: 390, h: 844 });
    const expectedSw = 1072 * (390 / 844);
    expect(crop.sw).toBeCloseTo(expectedSw, 2);
    expect(crop.sh).toBe(1072);
    expect(crop.sx).toBeCloseTo(960 - expectedSw / 2, 2); // foco x = 0.5
  });

  it("follows the focus: at progress 0 the window sits on the left edge", () => {
    expect(planDraw(manifest, "desktop", 0, { w: 390, h: 844 }).crop.sx).toBe(0);
  });

  it("uses the tier's own pixel size as the source", () => {
    const { crop } = planDraw(manifest, "mobile", 0.5, { w: 390, h: 844 });
    expect(crop.sh).toBe(536);
  });
});
