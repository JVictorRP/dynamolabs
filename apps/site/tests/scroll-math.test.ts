import { describe, expect, it } from "vitest";
import { clamp01, damp, easeInOutCubic, interpolateFocus, progressToFrame, segment } from "../src/lib/scroll/math";
import { coverRect } from "../src/lib/scroll/crop";

describe("segment", () => {
  it("normalizes progress inside [start, end] and clamps outside", () => {
    expect(segment(0.5, 0.25, 0.75)).toBe(0.5);
    expect(segment(0.1, 0.25, 0.75)).toBe(0);
    expect(segment(0.9, 0.25, 0.75)).toBe(1);
  });

  it("rejects an empty or inverted window", () => {
    expect(() => segment(0.5, 0.5, 0.5)).toThrow(RangeError);
    expect(() => segment(0.5, 0.8, 0.2)).toThrow(RangeError);
  });
});

describe("clamp01 and easeInOutCubic", () => {
  it("clamps to [0, 1]", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(7)).toBe(1);
  });

  it("is 0 at 0, 0.5 at 0.5 and 1 at 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
});

describe("progressToFrame", () => {
  it("maps progress to a frame pair and a blend factor", () => {
    expect(progressToFrame(0.5, 121)).toEqual({ index: 60, next: 61, mix: 0 });
    expect(progressToFrame(0.25, 121)).toEqual({ index: 30, next: 31, mix: 0 });
  });

  it("stops on the last frame at progress 1", () => {
    expect(progressToFrame(1, 121)).toEqual({ index: 120, next: 120, mix: 0 });
  });

  it("blends between neighbours at fractional positions", () => {
    const f = progressToFrame(0.505, 121);
    expect(f.index).toBe(60);
    expect(f.next).toBe(61);
    expect(f.mix).toBeCloseTo(0.6, 5);
  });
});

describe("damp", () => {
  it("moves toward the target by 1 - e^(-lambda*dt)", () => {
    expect(damp(0, 1, 10, 0.1)).toBeCloseTo(0.6321, 4);
  });
});

describe("interpolateFocus", () => {
  const keys = [{ at: 0, x: 0, y: 0 }, { at: 1, x: 1, y: 1 }];

  it("interpolates linearly between keys", () => {
    expect(interpolateFocus(keys, 0.25)).toEqual({ x: 0.25, y: 0.25 });
  });

  it("holds the first and last key outside the range", () => {
    expect(interpolateFocus(keys, -1)).toEqual({ x: 0, y: 0 });
    expect(interpolateFocus(keys, 2)).toEqual({ x: 1, y: 1 });
  });
});

describe("coverRect", () => {
  const src = { w: 1920, h: 1080 };
  const dst = { w: 390, h: 844 };

  it("crops a portrait window out of a landscape frame, centered on the focus", () => {
    const r = coverRect(src, dst, { x: 0.5, y: 0.5 });
    expect(r.sw).toBeCloseTo(499.05, 1);
    expect(r.sh).toBe(1080);
    expect(r.sx).toBeCloseTo(710.5, 1);
    expect(r.sy).toBe(0);
  });

  it("clamps the window to the frame edges", () => {
    expect(coverRect(src, dst, { x: 0, y: 0.5 }).sx).toBe(0);
    const right = coverRect(src, dst, { x: 1, y: 0.5 });
    expect(right.sx).toBeCloseTo(1920 - 499.05, 1);
  });
});
