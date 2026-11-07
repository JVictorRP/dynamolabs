import { describe, expect, it } from "vitest";
import { pickTier } from "../src/lib/frames/tier";

describe("pickTier (item: a phone in landscape was served the 1920px frames)", () => {
  it("uses the light frames whenever the SHORT side is a phone/tablet size, in either orientation", () => {
    expect(pickTier(390, 844)).toBe("mobile");
    expect(pickTier(844, 390)).toBe("mobile"); // celular deitado
    expect(pickTier(768, 1024)).toBe("mobile");
    expect(pickTier(1024, 768)).toBe("mobile");
  });

  it("uses the full frames on desktop-sized screens", () => {
    expect(pickTier(1440, 900)).toBe("desktop");
    expect(pickTier(1920, 1080)).toBe("desktop");
    expect(pickTier(1280, 800)).toBe("desktop");
  });
});
