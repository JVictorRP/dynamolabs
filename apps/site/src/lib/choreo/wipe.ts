import { clamp01 } from "../scroll/math";

/**
 * Faixa de luz entre as seções escura e clara (degradê só preto↔branco). `edge` é a fração da altura coberta de
 * branco, medida a partir de baixo: subindo (`up`) o branco cresce de baixo para cima; saindo (`down`) ele
 * encolhe e o escuro volta pelo topo. `softness` é a largura do degradê da borda, em fração da altura.
 */
export function wipeEdge(p: number, dir: "up" | "down"): { edge: number; softness: number } {
  const t = clamp01(p);
  return { edge: dir === "up" ? t : 1 - t, softness: 0.12 };
}
