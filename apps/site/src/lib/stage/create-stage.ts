import { FrameStore } from "../frames/frame-store";
import { frameUrl } from "../frames/manifest";
import { progressToFrame } from "../scroll/math";
import { createCanvas2dStage } from "./canvas2d-stage";
import { planDraw } from "./plan-draw";
import type { DrawPlan, StageHandle, StageOptions, StageRenderer } from "./types";

type Backend = { renderer: StageRenderer; scene: StageHandle["scene"]; camera: StageHandle["camera"]; renderAll: () => void; setScrims?: StageHandle["setScrims"] };

/**
 * O Three.js (r155+) só funciona em WebGL2. A sondagem usa um canvas DESCARTÁVEL: pedir um contexto ao canvas real
 * o prende àquele tipo e, se o WebGL depois falhasse, o canvas 2D de reserva nunca conseguiria o seu.
 */
const hasWebGL = (canvas: HTMLCanvasElement) => {
  const probe = canvas.ownerDocument ? canvas.ownerDocument.createElement("canvas") : canvas;
  return Boolean(probe.getContext("webgl2"));
};
const nextFrame = (cb: () => void) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(cb) : setTimeout(cb, 16));

/**
 * Cria o palco de um vídeo: carrega os frames (FrameStore) e os desenha num canvas em função do progresso.
 * O Three.js só é baixado se o navegador tiver WebGL; senão cai no canvas 2D.
 */
export async function createStage(canvas: HTMLCanvasElement, opts: StageOptions): Promise<StageHandle> {
  const { manifest, tier } = opts;
  let progress = opts.initialProgress ?? 0;
  let last: DrawPlan | null = null;
  let scheduled = false;
  let disposed = false;
  let firstFrameMarked = false;

  const store = new FrameStore(manifest, tier, { stride: opts.stride, onDecoded: () => schedule() });

  let backend: Backend | null = null;
  if (!opts.forceCanvas2d && hasWebGL(canvas)) {
    try {
      globalThis.dispatchEvent?.(new Event("stage:webgl-loading"));
      const { createWebGLStage } = await import("./webgl-stage");
      backend = createWebGLStage(canvas);
    } catch {
      backend = null; // sem GPU utilizável: segue para o canvas 2D
    }
  }
  const isWebGL = backend !== null;
  if (!backend) {
    const renderer = createCanvas2dStage(canvas);
    backend = { renderer, scene: null, camera: null, renderAll: () => paint() };
  }
  const active = backend;

  function paint() {
    if (disposed) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const plan = planDraw(manifest, tier, progress, { w, h });
    last = plan;
    store.request(plan.index);
    const a = store.get(plan.index);
    if (a) {
      const b = store.get(plan.next);
      active.renderer.draw(a, b ?? a, b ? plan.mix : 0, plan.crop);
      markFirstFrame();
      return;
    }
    const near = store.nearest(plan.index);
    if (near) {
      active.renderer.draw(near.bitmap, near.bitmap, 0, plan.crop);
      markFirstFrame();
    }
  }

  /** Marca (uma vez por palco) o instante em que o primeiro frame do vídeo apareceu: alimenta a medição de desempenho. */
  function markFirstFrame() {
    if (firstFrameMarked) return;
    firstFrameMarked = true;
    performance.mark(`stage:first-frame:${manifest.id}`);
  }

  function schedule() {
    if (scheduled || disposed) return;
    scheduled = true;
    nextFrame(() => {
      scheduled = false;
      paint();
    });
  }

  function resize() {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, tier === "mobile" ? 1.5 : 2);
    active.renderer.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, dpr);
    schedule();
  }

  // O primeiro frame mostrado é o da posição inicial; assim, atualizar a página no meio não pisca o frame 0.
  void (async () => {
    try {
      const index = progressToFrame(progress, manifest.frames).index;
      const res = await fetch(frameUrl(manifest, tier, index));
      if (!res.ok || disposed) return;
      const bitmap = await createImageBitmap(await res.blob());
      if (disposed) return void bitmap.close();
      store.setPoster(index, bitmap);
      schedule();
    } catch {
      // Sem poster, o primeiro frame decodificado pela janela assume.
    }
  })();

  resize();
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
  observer?.observe(canvas);
  schedule();

  return {
    setProgress(p) {
      progress = p;
      schedule();
    },
    resize,
    setScrims(scrims) {
      active.setScrims?.(scrims);
      schedule();
    },
    render() {
      active.renderAll();
    },
    async settled() {
      paint();
      await store.idle();
      paint();
    },
    dispose() {
      disposed = true;
      observer?.disconnect();
      store.dispose();
      active.renderer.dispose();
    },
    renderer: isWebGL ? "webgl" : "canvas2d",
    scene: active.scene,
    camera: active.camera,
    get lastDraw() {
      return last;
    },
  };
}
