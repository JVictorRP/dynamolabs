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

describe("createStage probes WebGL on a throwaway canvas (item: a WebGL1-only device ended up with no text at all)", () => {
  it("never touches the real canvas with webgl/webgl2, so the 2D fallback can still get its context", async () => {
    const ctx2d = { setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), globalAlpha: 1 };
    // Como um navegador de verdade: depois de entregar um contexto WebGL, um canvas não entrega mais o "2d".
    let pinnedToWebgl = false;
    const real = {
      width: 0,
      height: 0,
      clientWidth: 390,
      clientHeight: 844,
      style: {},
      getContext: vi.fn((type: string) => {
        if (type === "2d") return pinnedToWebgl ? null : ctx2d;
        pinnedToWebgl = true;
        return {};
      }),
      ownerDocument: {
        // o canvas descartável: só WebGL1 (sem webgl2)
        createElement: () => ({ getContext: (type: string) => (type === "webgl" ? {} : null) }),
      },
    } as unknown as HTMLCanvasElement;

    const stage = await createStage(real, { manifest, tier: "desktop" });
    expect(stage.renderer).toBe("canvas2d");
    expect(real.getContext).not.toHaveBeenCalledWith("webgl");
    expect(real.getContext).not.toHaveBeenCalledWith("webgl2");
    stage.dispose();
  });
});
