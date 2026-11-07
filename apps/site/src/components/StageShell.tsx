"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { registerStage, type StageId } from "@/lib/choreo/register-stage";
import { stageWrapperHeight } from "@/lib/choreo/stage-progress";

/**
 * Palco preso: um contêiner alto (a rolagem do palco) com um quadro `sticky` de 100svh dentro.
 * A altura vem do CSS, então o documento já tem o tamanho certo antes do JavaScript.
 */
export function StageShell({ id, pinVh, onProgress, className, children }: {
  id: StageId;
  pinVh: number;
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
    <section ref={ref} data-stage={id} style={{ height: stageWrapperHeight(pinVh) }} className={className}>
      <div data-sticky className="sticky top-0 h-svh w-full overflow-hidden">
        {children}
      </div>
    </section>
  );
}
