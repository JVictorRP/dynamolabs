import { segment } from "../scroll/math";
import type { SiteProgress } from "./header-state";

/** Parte do palco do chat em que a faixa de luz sobe (início) e sai (fim). */
export const WIPE_ZONE = 0.15;

/** Em que seção do site o menu está, a partir do progresso (0–1) de cada palco. */
export function siteSection(stages: { hero: number; chat: number; video2: number }): SiteProgress {
  const { hero, chat, video2 } = stages;
  if (video2 > 0) return { section: "video2", p: video2 };
  if (chat <= 0) return { section: "hero-s2", p: hero };
  if (chat < WIPE_ZONE) return { section: "wipe-in", p: chat / WIPE_ZONE };
  if (chat <= 1 - WIPE_ZONE) return { section: "chat", p: segment(chat, WIPE_ZONE, 1 - WIPE_ZONE) };
  return { section: "wipe-out", p: segment(chat, 1 - WIPE_ZONE, 1) };
}
