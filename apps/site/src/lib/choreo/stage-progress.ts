import { clamp01 } from "../scroll/math";

/**
 * Progresso (0–1) de um palco "sticky": quanto o topo do contêiner já subiu acima do viewport,
 * dividido pelo curso de rolagem (altura do contêiner menos a altura do quadro preso).
 */
export function stageProgress(wrapperTop: number, wrapperHeight: number, stickyHeight: number): number {
  const range = wrapperHeight - stickyHeight;
  if (range <= 0) return 0;
  return clamp01(-wrapperTop / range);
}

/** Onde está o topo do palco, em fração da altura da tela: 1 = logo abaixo dela (ou mais longe), 0 = já chegou ao topo. */
export function stageEdge(wrapperTop: number, viewportHeight: number): number {
  return viewportHeight > 0 ? clamp01(wrapperTop / viewportHeight) : 1;
}

/** Altura CSS do contêiner de um palco com `pinVh` de rolagem (usa svh: não muda com a barra do navegador móvel). */
export function stageWrapperHeight(pinVh: number): string {
  return `calc(100svh + ${pinVh}svh)`;
}
