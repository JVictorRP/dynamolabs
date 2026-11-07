import { describe, expect, it } from "vitest";
import { isRedBoxFrame, selectFrames } from "../scripts/lib/frame-plan";

/** Monta um buffer RGB (3 bytes por pixel) preenchido com uma cor. */
function solid(w: number, h: number, [r, g, b]: [number, number, number]): Uint8Array {
  const buf = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) buf.set([r, g, b], i * 3);
  return buf;
}

describe("selectFrames", () => {
  it("keeps every frame when nothing is dropped", () => {
    const kept = selectFrames(121, null);
    expect(kept).toHaveLength(121);
    expect(kept[0]).toBe(0);
    expect(kept.at(-1)).toBe(120);
  });

  it("drops the frame at dropFromIndex and everything after it", () => {
    const kept = selectFrames(121, 120);
    expect(kept).toHaveLength(120);
    expect(kept.at(-1)).toBe(119);
  });
});

describe("isRedBoxFrame", () => {
  it("flags a frame with a 1px pure-red border", () => {
    const w = 100, h = 100;
    const buf = solid(w, h, [40, 30, 20]);
    for (let x = 0; x < w; x++) { buf.set([255, 0, 0], x * 3); buf.set([255, 0, 0], ((h - 1) * w + x) * 3); }
    for (let y = 0; y < h; y++) { buf.set([255, 0, 0], y * w * 3); buf.set([255, 0, 0], (y * w + (w - 1)) * 3); }
    expect(isRedBoxFrame(buf, w, h)).toBe(true);
  });

  it("does not flag warm wood tones", () => {
    expect(isRedBoxFrame(solid(100, 100, [150, 90, 70]), 100, 100)).toBe(false);
  });
});
