import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { framesVersion } from "../scripts/lib/frames-version";

describe("framesVersion (item: frames cached for a year had no version in their URL)", () => {
  it("is a short, stable hex id of the frame bytes", () => {
    const a = framesVersion([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]);
    expect(a).toMatch(/^[0-9a-f]{10}$/);
    expect(framesVersion([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])])).toBe(a);
  });

  it("changes when any byte of any frame changes, and when frames are added or reordered", () => {
    const base = framesVersion([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]);
    expect(framesVersion([new Uint8Array([1, 2, 3]), new Uint8Array([4, 6])])).not.toBe(base);
    expect(framesVersion([new Uint8Array([1, 2, 3])])).not.toBe(base);
    expect(framesVersion([new Uint8Array([4, 5]), new Uint8Array([1, 2, 3])])).not.toBe(base);
  });
});

describe("generated manifests carry the version in every frame URL", () => {
  const root = new URL("../public/frames/", import.meta.url);
  for (const id of readdirSync(root).filter((d) => /^v\d+$/.test(d))) {
    it(`${id}/manifest.json has a version and a versioned pathPattern`, () => {
      const manifest = JSON.parse(readFileSync(new URL(`${id}/manifest.json`, root), "utf8"));
      expect(manifest.version).toMatch(/^[0-9a-f]{10}$/);
      expect(manifest.pathPattern).toBe(`/frames/${id}/{tier}/{n}.webp?v=${manifest.version}`);
    });
  }
});
