import { describe, expect, it } from "vitest";
import { frameUrl, type FrameManifest } from "../src/lib/frames/manifest";

const manifest: FrameManifest = {
  id: "v2",
  frames: 121,
  tiers: { desktop: { width: 1920, height: 1080 }, mobile: { width: 960, height: 540 } },
  pathPattern: "/frames/v2/{tier}/{n}.webp",
  focus: [{ at: 0, x: 0.5, y: 0.5 }],
};

describe("frameUrl", () => {
  it("substitutes the tier and a 1-based, 4-digit frame number", () => {
    expect(frameUrl(manifest, "desktop", 0)).toBe("/frames/v2/desktop/0001.webp");
    expect(frameUrl(manifest, "mobile", 120)).toBe("/frames/v2/mobile/0121.webp");
  });
});
