import { describe, expect, it } from "vitest";
import { layerOffset, pointerTilt } from "../src/lib/choreo/parallax";

describe("layerOffset", () => {
  it("a layer at speed 1 follows the scroll exactly (no offset); slower layers lag behind", () => {
    expect(layerOffset(100, 1)).toBe(0);
    expect(layerOffset(100, 0.5)).toBe(50);
    expect(layerOffset(100, 0.2)).toBeCloseTo(80, 6);
    expect(layerOffset(0, 0.3)).toBe(0);
  });
});

describe("pointerTilt", () => {
  it("tilts proportionally to the pointer distance from the center", () => {
    expect(pointerTilt(100, 0, 6)).toEqual({ rx: 0, ry: 1 });
    expect(pointerTilt(0, 200, 6)).toEqual({ rx: -2, ry: 0 });
  });

  it("is clamped to the maximum angle in both axes and rests at zero", () => {
    expect(pointerTilt(1000, 1000, 6)).toEqual({ rx: -6, ry: 6 });
    expect(pointerTilt(-1000, -1000, 6)).toEqual({ rx: 6, ry: -6 });
    expect(pointerTilt(0, 0, 6)).toEqual({ rx: 0, ry: 0 });
  });
});
