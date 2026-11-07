"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { registerStage, type StageId } from "@/lib/choreo/register-stage";
import { EDGE_SOFTNESS_VH } from "@/lib/choreo/overlap";
import { stageWrapperHeight } from "@/lib/choreo/stage-progress";

/**
 * Palco preso: um contêiner alto (a rolagem do palco) com um quadro `sticky` de 100svh dentro.
 * A altura vem do CSS, então o documento já tem o tamanho certo antes do JavaScript.
 */
export function StageShell({ id, pinVh, onProgress, className, children, overlapVh = 0, edge, zIndex = 0 }: {
  id: StageId;
  pinVh: number;
  /** Sobreposição à seção anterior (svh): este palco começa `overlapVh` antes de o anterior acabar e desliza por cima dele. */
  overlapVh?: number;
  /** Cor do degradê suave acima do topo (a borda da seção que chega): branco ou preto. */
  edge?: "light" | "dark";
  /** Ordem de empilhamento (a seção que chega fica por cima da anterior). */
  zIndex?: number;
  onProgress?: (p: number) => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const callback = useRef(onProgress);
  useEffect(() => {
    callback.current = onProgress;
  });
  useEffect(() => registerStage(ref.current!, { id, pinVh, onProgress: (p) => callback.current?.(p) }), [id, pinVh]);

  return (
    <section
      ref={ref}
      data-stage={id}
      style={{ height: stageWrapperHeight(pinVh), ...(overlapVh ? { marginTop: `-${overlapVh}svh`, position: "relative", zIndex } : {}) }}
      className={className}
    >
      {edge && overlapVh > 0 && (
        <div
          aria-hidden="true"
          data-edge={edge}
          className="pointer-events-none absolute inset-x-0"
          style={{
            bottom: "100%",
            height: `${EDGE_SOFTNESS_VH}svh`,
            background: edge === "light" ? "linear-gradient(to top, #ffffff, rgba(255,255,255,0))" : "linear-gradient(to top, #0a0a0a, rgba(10,10,10,0))",
          }}
        />
      )}
      <div data-sticky className="sticky top-0 h-svh w-full overflow-hidden">
        {children}
      </div>
    </section>
  );
}
