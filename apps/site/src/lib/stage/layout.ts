import { unitsPerPx } from "./camera";

export type Viewport = { w: number; h: number };
/** Posição de um bloco de título no viewport: tamanho da fonte, borda esquerda e linha de base da última linha (px, medida de baixo). */
export type BlockLayout = { fontPx: number; left: number; bottom: number };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const margin = (vp: Viewport) => clamp(vp.w * 0.05, 20, 72);
const isPortrait = (vp: Viewport) => vp.w < vp.h * 0.9;

/**
 * Hero: título no canto inferior esquerdo, com espaço embaixo para a dica de rolagem. A fonte respeita a
 * largura real do título (`widthEm`): em tela larga ocupa no máximo 62% da largura (fica longe do logo aceso
 * da cena); em tela vertical cabe entre as duas margens.
 */
export function heroLayout(vp: Viewport, block: { widthEm: number }): BlockLayout {
  const widthCap = (isPortrait(vp) ? vp.w - 2 * margin(vp) : vp.w * 0.62) / block.widthEm;
  return {
    fontPx: clamp(Math.min(vp.w * 0.115, vp.h * 0.17, widthCap), 24, 128),
    left: margin(vp),
    bottom: clamp(vp.h * 0.12, 48, 120),
  };
}

/**
 * Seção 2: bloco alinhado à direita, longe do assunto (o caderno, que cresce e ocupa a metade inferior do quadro).
 * Em tela horizontal fica no canto superior direito (centro a 26% do topo), inteiro na metade direita; em tela
 * vertical sobe para o terço superior (centro a 30% do topo).
 */
export function s2Layout(vp: Viewport, block: { widthEm: number; heightEm: number }): BlockLayout {
  const portrait = isPortrait(vp);
  const widthCap = (portrait ? vp.w - 2 * margin(vp) : vp.w * 0.5 - margin(vp)) / block.widthEm;
  const fontPx = clamp(Math.min(vp.w * 0.075, vp.h * (portrait ? 0.12 : 0.085), widthCap), 32, 96);
  const centerFromBottom = vp.h * (portrait ? 0.7 : 0.74);
  return {
    fontPx,
    left: vp.w - margin(vp) - block.widthEm * fontPx,
    bottom: centerFromBottom - (block.heightEm * fontPx) / 2,
  };
}

/**
 * Vídeo 2: o texto fica na lateral esquerda, longe do celular (que ocupa o centro-baixo do quadro) e da notificação
 * que surge no canto da tela dele. Paisagem: cabe nos 55% da esquerda, centro a 26% do topo; retrato: terço superior.
 */
export function video2Layout(vp: Viewport, block: { widthEm: number; heightEm: number }): BlockLayout {
  const portrait = isPortrait(vp);
  const widthCap = (portrait ? vp.w - 2 * margin(vp) : vp.w * 0.55 - margin(vp)) / block.widthEm;
  const fontPx = clamp(Math.min(vp.w * 0.075, vp.h * (portrait ? 0.12 : 0.085), widthCap), 30, 96);
  const centerFromBottom = vp.h * (portrait ? 0.7 : 0.74);
  return { fontPx, left: margin(vp), bottom: centerFromBottom - (block.heightEm * fontPx) / 2 };
}

/** Escala e posição (unidades da cena, plano z = 0) de um `Title3D` — origem à esquerda e no centro vertical do bloco. */
export function blockPlacement(layout: BlockLayout, heightEm: number, vp: Viewport): { scale: number; x: number; y: number } {
  const u = unitsPerPx(vp.h);
  const centerFromBottom = layout.bottom + (heightEm * layout.fontPx) / 2;
  return {
    scale: layout.fontPx * u,
    x: (layout.left - vp.w / 2) * u,
    y: (centerFromBottom - vp.h / 2) * u,
  };
}
