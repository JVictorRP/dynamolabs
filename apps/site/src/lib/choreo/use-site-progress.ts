"use client";

import { useSyncExternalStore } from "react";
import type { SiteProgress } from "./header-state";
import { getStageProgress, subscribeProgress, type StageId } from "./register-stage";
import { siteSection } from "./site-section";

const useStage = (id: StageId) => useSyncExternalStore(subscribeProgress, () => getStageProgress(id), () => 0);

/** Seção e progresso atuais do site (para o menu), a partir do progresso real de cada palco. */
export function useSiteProgress(): SiteProgress {
  return siteSection({ hero: useStage("hero-s2"), chat: useStage("chat"), video2: useStage("video2") });
}
