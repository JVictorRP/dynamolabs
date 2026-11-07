import { clamp01 } from "../scroll/math";

/** Geometria de um palco preso: topo do contêiner no documento, altura do contêiner e altura do quadro sticky. */
export type StageBox = { wrapperTop: number; wrapperHeight: number; stickyHeight: number };

/** Em que ponto do palco cada âncora aterrissa (0–1). O padrão é o meio, onde o conteúdo está inteiro na tela. */
export const ANCHOR_PROGRESS: Record<string, number> = { chatbot: 0.5 };

/**
 * Posição de rolagem (px do documento) para um progresso dentro de um palco. Um link `#id` para algo dentro de um
 * palco preso cairia no progresso 0 (o primeiro quadro, escuro e vazio); com isto cai onde o conteúdo aparece.
 */
export function stageAnchorY(box: StageBox, progress: number): number {
  const range = Math.max(0, box.wrapperHeight - box.stickyHeight);
  return box.wrapperTop + clamp01(progress) * range;
}

/** Rola até o alvo de `#id`; se ele está dentro de um palco preso, vai ao progresso certo do palco. Devolve a posição (px) ou `null` se o alvo não está num palco. */
export function resolveStageAnchor(id: string): number | null {
  const target = document.getElementById(id);
  const wrapper = target?.closest<HTMLElement>("[data-stage]");
  const sticky = wrapper?.querySelector<HTMLElement>("[data-sticky]");
  if (!target || !wrapper || !sticky) return null;
  return stageAnchorY(
    { wrapperTop: wrapper.getBoundingClientRect().top + window.scrollY, wrapperHeight: wrapper.offsetHeight, stickyHeight: sticky.offsetHeight },
    ANCHOR_PROGRESS[id] ?? 0.5,
  );
}
