import { describe, expect, it } from "vitest";
import { breather, heroScrim, s2Scrim } from "../src/lib/choreo/scrims";

describe("heroScrim (darkens behind the hero block, then leaves with it, 25–45%)", () => {
  it("is full until 25% and gone at 45%", () => {
    expect(heroScrim(0)).toBe(1);
    expect(heroScrim(0.25)).toBe(1);
    expect(heroScrim(0.35)).toBeCloseTo(0.5, 6);
    expect(heroScrim(0.45)).toBe(0);
    expect(heroScrim(0.9)).toBe(0);
  });
});

describe("s2Scrim (darkens the right side while section 2 is on screen)", () => {
  it("ramps in over 40–55%, holds, and ramps out over 82–86%", () => {
    expect(s2Scrim(0.3)).toBe(0);
    expect(s2Scrim(0.475)).toBeCloseTo(0.5, 6);
    expect(s2Scrim(0.7)).toBe(1);
    expect(s2Scrim(0.84)).toBeCloseTo(0.5, 6);
    expect(s2Scrim(0.9)).toBe(0);
  });
});

describe("breather (the frame darkens to black in the last 20%)", () => {
  it("is 0 until 80%, 0.5 at 90% and 1 at the end", () => {
    expect(breather(0.8)).toBe(0);
    expect(breather(0.9)).toBeCloseTo(0.5, 6);
    expect(breather(1)).toBe(1);
  });
});
