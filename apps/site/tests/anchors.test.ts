import { describe, expect, it } from "vitest";
import { stageAnchorY } from "../src/lib/choreo/anchors";

describe("stageAnchorY (item: the Chatbot link landed on the first, black, frame of the stage)", () => {
  // Palco de 350svh em um viewport de 1000px: contêiner 4500, quadro sticky 1000, curso 3500.
  it("scrolls to the requested progress inside the stage, not to its top", () => {
    expect(stageAnchorY({ wrapperTop: 2000, wrapperHeight: 4500, stickyHeight: 1000 }, 0.5)).toBe(2000 + 0.5 * 3500);
    expect(stageAnchorY({ wrapperTop: 2000, wrapperHeight: 4500, stickyHeight: 1000 }, 0)).toBe(2000);
    expect(stageAnchorY({ wrapperTop: 2000, wrapperHeight: 4500, stickyHeight: 1000 }, 1)).toBe(2000 + 3500);
  });

  it("clamps the progress and survives a stage with no scroll range", () => {
    expect(stageAnchorY({ wrapperTop: 100, wrapperHeight: 4500, stickyHeight: 1000 }, 3)).toBe(100 + 3500);
    expect(stageAnchorY({ wrapperTop: 100, wrapperHeight: 1000, stickyHeight: 1000 }, 0.5)).toBe(100);
  });
});
