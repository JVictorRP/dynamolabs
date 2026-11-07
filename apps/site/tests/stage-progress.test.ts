import { describe, expect, it } from "vitest";
import { stageEdge, stageProgress, stageWrapperHeight } from "../src/lib/choreo/stage-progress";

// Um palco de 450svh de rolagem: wrapper = 100svh (sticky) + 450svh. Em um viewport de 1000px: wrapper 5500, sticky 1000, curso 4500.
describe("stageProgress", () => {
  const wrapperHeight = 5500;
  const stickyHeight = 1000;

  it("is 0 while the stage has not started pinning", () => {
    expect(stageProgress(300, wrapperHeight, stickyHeight)).toBe(0);
    expect(stageProgress(0, wrapperHeight, stickyHeight)).toBe(0);
  });

  it("is proportional to how far the wrapper top went above the viewport", () => {
    expect(stageProgress(-2250, wrapperHeight, stickyHeight)).toBe(0.5);
    expect(stageProgress(-1125, wrapperHeight, stickyHeight)).toBe(0.25);
  });

  it("is 1 once the stage has been fully scrolled through", () => {
    expect(stageProgress(-4500, wrapperHeight, stickyHeight)).toBe(1);
    expect(stageProgress(-9000, wrapperHeight, stickyHeight)).toBe(1);
  });

  it("is 0 (not NaN) for a wrapper with no scroll range", () => {
    expect(stageProgress(-100, 1000, 1000)).toBe(0);
  });
});

describe("stageWrapperHeight", () => {
  it("builds the CSS height from the pin length in svh", () => {
    expect(stageWrapperHeight(450)).toBe("calc(100svh + 450svh)");
  });
});

describe("stageEdge (where the top of a stage is, as a fraction of the screen height)", () => {
  it("is 1 while the stage is below the screen, 0 once its top reaches the top, and in between while it slides in", () => {
    expect(stageEdge(1500, 900)).toBe(1);
    expect(stageEdge(900, 900)).toBe(1);
    expect(stageEdge(450, 900)).toBeCloseTo(0.5, 6);
    expect(stageEdge(0, 900)).toBe(0);
    expect(stageEdge(-3000, 900)).toBe(0);
  });
});

describe("stageWrapperHeight with an overlap", () => {
  it("does not change the stage's own scroll length (the overlap is a negative margin, not a shorter stage)", () => {
    expect(stageWrapperHeight(350)).toBe("calc(100svh + 350svh)");
  });
});
