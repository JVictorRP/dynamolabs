"use client";

import { useEffect } from "react";
import { resolveStageAnchor } from "@/lib/choreo/anchors";
import { scrollToY } from "@/lib/choreo/smooth-scroll";

/**
 * Faz os links `#id` que apontam para dentro de um palco preso (ex.: #chatbot) aterrissarem no meio do palco, onde o
 * conteúdo aparece, em vez de no primeiro quadro (escuro e vazio). Vale para cliques e para um `#id` já na URL.
 */
export function StageAnchors() {
  useEffect(() => {
    const go = (id: string, immediate = false): boolean => {
      const y = resolveStageAnchor(id);
      if (y === null) return false;
      scrollToY(y, { immediate });
      return true;
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href^='#']");
      const id = link?.getAttribute("href")?.slice(1);
      if (id && go(id)) {
        event.preventDefault();
        history.replaceState(null, "", `#${id}`);
      }
    };
    document.addEventListener("click", onClick);

    // Link direto com #id na URL: o navegador rolaria para o topo do palco; depois do layout, vamos ao ponto certo.
    if (location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1));
      requestAnimationFrame(() => requestAnimationFrame(() => void go(id, true)));
    }
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
