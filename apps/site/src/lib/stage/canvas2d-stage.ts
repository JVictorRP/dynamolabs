import type { StageRenderer } from "./types";

/** Renderer de reserva (sem WebGL): desenha os dois frames com `drawImage` e `globalAlpha`. */
export function createCanvas2dStage(canvas: HTMLCanvasElement): StageRenderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D indisponível");
  return {
    resize(width, height, dpr) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    },
    draw(a, b, mix, { sx, sy, sw, sh }) {
      ctx.globalAlpha = 1;
      ctx.drawImage(a, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      if (mix > 0 && b !== a) {
        ctx.globalAlpha = mix;
        ctx.drawImage(b, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    },
    dispose() {},
  };
}
