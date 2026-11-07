"use client";

import { useEffect, useRef } from "react";
import { StageShell } from "@/components/StageShell";
import type { FrameManifest } from "@/lib/frames/manifest";
import { measureStageProgress } from "@/lib/choreo/register-stage";
import { createStage } from "@/lib/stage/create-stage";
import type { StageHandle } from "@/lib/stage/types";

export function LabPinned() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<StageHandle | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrapper = canvas.closest<HTMLElement>("[data-stage]")!;
    let cancelled = false;
    (async () => {
      const manifest = (await (await fetch("/frames/v1/manifest.json")).json()) as FrameManifest;
      const tier = window.innerWidth <= 768 ? "mobile" : "desktop";
      const initialProgress = measureStageProgress(wrapper);
      const stage = await createStage(canvas, { manifest, tier, initialProgress });
      if (cancelled) return stage.dispose();
      stageRef.current = stage;
      stage.setProgress(window.__dynamo?.progress["hero-s2"] ?? initialProgress);
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
      <StageShell id="hero-s2" pinVh={450} onProgress={(p) => stageRef.current?.setProgress(p)}>
        <canvas ref={canvasRef} className="h-full w-full" />
      </StageShell>
      <div className="grid h-svh place-items-center bg-white text-graphite">depois do palco</div>
    </main>
  );
}
