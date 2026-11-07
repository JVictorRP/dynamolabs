import { easeInOutCubic, segment } from "../scroll/math";

/** Transformação de um título 3D: rotação em X (rad), profundidade z, deslocamento x/y e opacidade. */
export type TitleState = { rotX: number; z: number; opacity: number; x: number; y: number };

/** Teto de opacidade do título da seção 2: leve transparência para o vídeo aparecer atrás. */
export const S2_OPACITY = 0.85;

/** Dobra máxima do hero ao sair (rad). */
const HERO_FOLD = -1.2;

// a + (b - a) * t: ao contrário de `b * t`, nunca produz zero negativo quando t = 0.
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hero (progresso do palco 0–1): fica inteiro até 25% e se dobra para trás, sumindo entre 25% e 45%. */
export function heroTitleState(p: number): TitleState {
  const t = easeInOutCubic(segment(p, 0.25, 0.45));
  return { rotX: lerp(0, HERO_FOLD, t), z: lerp(0, -2.5, t), opacity: lerp(1, 0, t), x: 0, y: lerp(0, -0.3, t) };
}

/** Seção 2: sobe da profundidade, pelo lado direito, entre 45% e 60%; sai no respiro, entre 80% e 88%. */
export function s2TitleState(p: number): TitleState {
  const enter = easeInOutCubic(segment(p, 0.45, 0.6));
  const leave = easeInOutCubic(segment(p, 0.8, 0.88));
  return {
    rotX: lerp(0.8, 0, enter) - 0.8 * leave,
    z: lerp(-2, 0, enter) - leave,
    opacity: S2_OPACITY * enter * (1 - leave),
    x: lerp(1.5, 0, enter),
    y: lerp(-0.5, 0, enter),
  };
}

/** Teto de opacidade do título do vídeo 2. */
export const VIDEO2_OPACITY = 0.9;

/** Vídeo 2: o título sobe da profundidade, pela esquerda, entre 2% e 18%, e fica até o fim (o CTA fecha o palco). */
export function video2TitleState(p: number): TitleState {
  const enter = easeInOutCubic(segment(p, 0.02, 0.18));
  return { rotX: lerp(0.8, 0, enter), z: lerp(-2, 0, enter), opacity: VIDEO2_OPACITY * enter, x: lerp(-1.5, 0, enter), y: lerp(-0.5, 0, enter) };
}
