"use client";

import dynamic from "next/dynamic";

/**
 * Carrega a linha de pensamento (que traz a biblioteca `motion`) só depois da hidratação: é decoração, e o JavaScript
 * inicial da página tem orçamento (200 KB gzip, `e2e/perf.spec.ts`). Sem JavaScript ela não aparece.
 */
export const ThoughtLineLazy = dynamic(() => import("./ThoughtLineCycle").then((m) => m.ThoughtLineCycle), { ssr: false });
