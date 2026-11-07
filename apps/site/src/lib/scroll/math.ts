import type { FocusKey } from "../frames/manifest";

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Normaliza `p` dentro da janela [start, end]: 0 antes, 1 depois, linear no meio. */
export function segment(p: number, start: number, end: number): number {
  if (!(start < end)) throw new RangeError(`segment: start (${start}) deve ser menor que end (${end})`);
  return clamp01((p - start) / (end - start));
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Posição (0–1) no vídeo → par de frames vizinhos e fator de mistura entre eles. */
export function progressToFrame(p: number, frameCount: number): { index: number; next: number; mix: number } {
  const last = frameCount - 1;
  const pos = clamp01(p) * last;
  const index = Math.min(Math.floor(pos), last);
  return { index, next: Math.min(index + 1, last), mix: index === last ? 0 : pos - index };
}

/** Suavização exponencial independente da taxa de quadros. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Ponto de foco interpolado linearmente entre chaves (ordenadas por `at`), preso nas pontas. */
export function interpolateFocus(keys: FocusKey[], p: number): { x: number; y: number } {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (p <= first.at) return { x: first.x, y: first.y };
  if (p >= last.at) return { x: last.x, y: last.y };
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (p <= b.at) {
      const a = keys[i - 1];
      const t = (p - a.at) / (b.at - a.at);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return { x: last.x, y: last.y };
}
