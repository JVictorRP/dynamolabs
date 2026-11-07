import type { SiteProgress } from "./header-state";

/** Quando o topo da seção que chega alcança o menu (fração da altura da tela, ~72 px), o menu muda de aparência. */
export const HEADER_EDGE = 0.08;

/**
 * Em que seção do site o menu está. As seções se sobrepõem (a seguinte desliza por cima da anterior), então não basta o
 * progresso de cada palco: `chatEdge` e `video2Edge` dizem onde está o topo da seção que chega (1 = abaixo da tela, 0 = no topo).
 */
export function siteSection(stages: { hero: number; chat: number; video2: number; chatEdge: number; video2Edge: number }): SiteProgress {
  if (stages.video2Edge <= HEADER_EDGE) return { section: "video2", p: stages.video2 };
  if (stages.chatEdge <= HEADER_EDGE) return { section: "chat", p: stages.chat };
  return { section: "hero-s2", p: stages.hero };
}
