import { segment } from "../scroll/math";

/** Intensidades (0–1) dos véus pretos desenhados entre o vídeo e os títulos. */
export type Scrims = { base: number; hero: number; s2: number; breather: number; leftTop: number };

/** Véu atrás do bloco do hero: cheio até 25%, some junto com ele até 45%. */
export const heroScrim = (p: number): number => 1 - segment(p, 0.25, 0.45);

/** Véu do lado direito, enquanto a seção 2 está na tela: entra em 40–55% e fica. */
export const s2Scrim = (p: number): number => segment(p, 0.4, 0.55);

/** Respiro: o quadro escurece até quase preto nos últimos 8%, enquanto o cartão do chat desliza por cima. */
export const breather = (p: number): number => segment(p, 0.92, 1);

/** Vídeo 2: véu no canto superior esquerdo (atrás do título), entra em 0–8% e fica. */
export const video2Scrim = (p: number): number => segment(p, 0, 0.08);

/** Vídeo 2: o quadro escurece até preto nos últimos 10%, para o footer entrar sem corte. */
export const video2Breather = (p: number): number => segment(p, 0.9, 1);
