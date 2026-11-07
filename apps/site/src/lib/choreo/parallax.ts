/** Quanto uma camada fica para trás do scroll: velocidade 1 acompanha o scroll (deslocamento 0); menores atrasam. */
export function layerOffset(scrollPx: number, speed: number): number {
  return scrollPx * (1 - speed);
}

/** Graus de inclinação por pixel de distância do ponteiro ao centro. */
const DEGREES_PER_PX = 0.01;

/** Inclinação (graus) do conjunto pelo ponteiro, em relação ao centro; presa a ±`max`. */
export function pointerTilt(dx: number, dy: number, max: number): { rx: number; ry: number } {
  const clamp = (v: number) => Math.min(max, Math.max(-max, v));
  return { rx: clamp(0 - dy * DEGREES_PER_PX), ry: clamp(0 + dx * DEGREES_PER_PX) };
}
