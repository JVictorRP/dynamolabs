"use client";

import { useEffect, useRef } from "react";
import type { FrameManifest } from "@/lib/frames/manifest";
import { createStage } from "@/lib/stage/create-stage";
import type { StageHandle } from "@/lib/stage/types";

export function LabStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<StageHandle | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let cancelled = false;
    (async () => {
      const manifest = (await (await fetch("/frames/v1/manifest.json")).json()) as FrameManifest;
      const tier = window.innerWidth <= 768 ? "mobile" : "desktop";
      const stage = await createStage(canvas, { manifest, tier, forceCanvas2d: new URLSearchParams(location.search).has("canvas2d") });
      if (cancelled) return stage.dispose();
      stageRef.current = stage;
      window.__lab = {
        setProgress: (p) => stage.setProgress(p),
        settled: () => stage.settled(),
        lastDraw: () => stage.lastDraw,
        renderer: stage.renderer,
      };
    })();
    return () => {
      cancelled = true;
      stageRef.current?.dispose();
      stageRef.current = null;
      delete window.__lab;
    };
  }, []);

  return (
    <main>
      <canvas ref={canvasRef} className="fixed inset-0 h-full w-full" />
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        defaultValue={0}
        data-testid="progress"
        aria-label="Progresso do vídeo"
        className="fixed bottom-4 left-4 right-4 z-10"
        onInput={(e) => stageRef.current?.setProgress(Number(e.currentTarget.value))}
      />
    </main>
  );
}
