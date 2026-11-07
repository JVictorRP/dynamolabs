import { describe, expect, it, vi } from "vitest";
import { createStage } from "../src/lib/stage/create-stage";
import type { FrameManifest } from "../src/lib/frames/manifest";

const manifest: FrameManifest = {
  id: "v1",
  frames: 119,
  tiers: { desktop: { width: 1920, height: 1072 }, mobile: { width: 960, height: 536 } },
  pathPattern: "/frames/v1/{tier}/{n}.webp",
  focus: [{ at: 0, x: 0.5, y: 0.5 }],
};

/** Canvas falso (os testes unitários rodam em node, sem DOM): 2D sempre existe, WebGL conforme o parâmetro. */
function stubCanvas(webgl: boolean): HTMLCanvasElement {
  const ctx2d = { setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), globalAlpha: 1 };
  return {
    width: 0,
    height: 0,
    clientWidth: 390,
    clientHeight: 844,
    style: {},
    getContext: vi.fn((type: string) => (type === "2d" ? ctx2d : webgl ? {} : null)),
  } as unknown as HTMLCanvasElement;
}

describe("createStage renderer selection", () => {
  it("uses the 2D canvas when forced", async () => {
    const stage = await createStage(stubCanvas(true), { manifest, tier: "desktop", forceCanvas2d: true });
    expect(stage.renderer).toBe("canvas2d");
    expect(stage.scene).toBeNull();
    expect(stage.camera).toBeNull();
    stage.dispose();
  });

  it("falls back to the 2D canvas when the browser has no WebGL context", async () => {
    const stage = await createStage(stubCanvas(false), { manifest, tier: "desktop" });
    expect(stage.renderer).toBe("canvas2d");
    stage.dispose();
  });
});
