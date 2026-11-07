import { describe, expect, it } from "vitest";
import { video2Breather, video2Scrim } from "../src/lib/choreo/scrims";
import { video2TitleState } from "../src/lib/choreo/title-motion";
import { video2Layout } from "../src/lib/stage/layout";

describe("video2Layout (copy on the left, away from the phone and its notification)", () => {
  const block = { widthEm: 7.7, heightEm: 2.52 };

  it("on landscape: left-aligned, inside the left 55%, ending above 45% of the height", () => {
    const l = video2Layout({ w: 1440, h: 900 }, block);
    expect(l.left).toBe(72);
    expect(l.left + l.fontPx * block.widthEm).toBeLessThanOrEqual(0.55 * 1440 + 0.01);
    expect(l.bottom).toBeCloseTo(0.74 * 900 - (2.52 * l.fontPx) / 2, 2);
    expect(l.bottom).toBeGreaterThanOrEqual(0.55 * 900);
  });

  it("on a portrait phone: left margin 20px, top third, never past the right margin", () => {
    const l = video2Layout({ w: 390, h: 844 }, block);
    expect(l.left).toBe(20);
    expect(l.left + l.fontPx * block.widthEm).toBeLessThanOrEqual(390 - 20 + 0.01);
    expect(l.bottom).toBeCloseTo(0.7 * 844 - (2.52 * l.fontPx) / 2, 2);
  });
});

describe("video2TitleState (rises from depth early and then stays; the CTA closes the stage)", () => {
  it("is invisible before 2% and fully there at 18%", () => {
    expect(video2TitleState(0.01).opacity).toBe(0);
    expect(video2TitleState(0.18).opacity).toBeCloseTo(0.9, 6);
    expect(video2TitleState(0.18).z).toBeCloseTo(0, 6);
  });

  it("starts deep in the scene and never exceeds the 0.9 translucency ceiling", () => {
    expect(video2TitleState(0.02).z).toBe(-2);
    for (let i = 0; i <= 100; i++) expect(video2TitleState(i / 100).opacity).toBeLessThanOrEqual(0.9);
  });

  it("stays visible until the end of the stage", () => {
    expect(video2TitleState(1).opacity).toBeCloseTo(0.9, 6);
  });
});

describe("video 2 scrims", () => {
  it("the upper-left scrim ramps in over the first 8% and stays", () => {
    expect(video2Scrim(0)).toBe(0);
    expect(video2Scrim(0.04)).toBeCloseTo(0.5, 6);
    expect(video2Scrim(0.5)).toBe(1);
    expect(video2Scrim(1)).toBe(1);
  });

  it("the frame fades to black over the last 10%, so the footer follows without a cut", () => {
    expect(video2Breather(0.9)).toBe(0);
    expect(video2Breather(0.95)).toBeCloseTo(0.5, 6);
    expect(video2Breather(1)).toBe(1);
  });
});
