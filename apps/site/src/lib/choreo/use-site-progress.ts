"use client";

import { useSyncExternalStore } from "react";
import type { SiteProgress } from "./header-state";
import { getStageEdge, getStageProgress, subscribeProgress, type StageId } from "./register-stage";
import { siteSection } from "./site-section";

const useStage = (id: StageId) => useSyncExternalStore(subscribeProgress, () => getStageProgress(id), () => 0);
const useEdge = (id: StageId) => useSyncExternalStore(subscribeProgress, () => getStageEdge(id), () => 1);

/** Seção e progresso atuais do site (para o menu), a partir do progresso real de cada palco. */
export function useSiteProgress(): SiteProgress {
  return siteSection({ hero: useStage("hero-s2"), chat: useStage("chat"), video2: useStage("video2"), chatEdge: useEdge("chat"), video2Edge: useEdge("video2") });
}
