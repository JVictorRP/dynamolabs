import { describe, expect, it } from "vitest";
import { wipeEdge } from "../src/lib/choreo/wipe";

describe("wipeEdge (the white band rises from the bottom and leaves from the top)", () => {
  it("rising: nothing white at 0 and the whole screen at 1", () => {
    expect(wipeEdge(0, "up").edge).toBe(0);
    expect(wipeEdge(1, "up").edge).toBe(1);
  });

  it("is monotonic while rising", () => {
    const edges = Array.from({ length: 21 }, (_, i) => wipeEdge(i / 20, "up").edge);
    edges.slice(1).forEach((e, i) => expect(e).toBeGreaterThanOrEqual(edges[i]));
  });

  it("leaving is the exact mirror: all white at 0, nothing at 1, half at 0.5", () => {
    expect(wipeEdge(0, "down").edge).toBe(1);
    expect(wipeEdge(1, "down").edge).toBe(0);
    expect(wipeEdge(0.5, "down").edge).toBeCloseTo(0.5, 6);
    expect(wipeEdge(0.3, "down").edge).toBeCloseTo(wipeEdge(0.7, "up").edge, 6);
  });

  it("has a soft edge (fraction of the height) and clamps the input", () => {
    expect(wipeEdge(0.5, "up").softness).toBeGreaterThan(0);
    expect(wipeEdge(-1, "up").edge).toBe(0);
    expect(wipeEdge(2, "up").edge).toBe(1);
  });
});
