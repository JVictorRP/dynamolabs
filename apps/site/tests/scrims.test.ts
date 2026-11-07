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
  it("ramps in over 40–55% and holds until the end of the stage", () => {
    expect(s2Scrim(0.3)).toBe(0);
    expect(s2Scrim(0.475)).toBeCloseTo(0.5, 6);
    expect(s2Scrim(0.7)).toBe(1);
    expect(s2Scrim(0.9)).toBe(1);
    expect(s2Scrim(1)).toBe(1);
  });
});

describe("breather (the frame darkens to black in the last 8%, as the chat card slides over it)", () => {
  it("is 0 until 92%, 0.5 at 96% and 1 at the end", () => {
    expect(breather(0.92)).toBe(0);
    expect(breather(0.96)).toBeCloseTo(0.5, 6);
    expect(breather(1)).toBe(1);
  });
});
