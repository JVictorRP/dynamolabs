import { describe, expect, it } from "vitest";
import { stageProgress, stageWrapperHeight } from "../src/lib/choreo/stage-progress";

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
