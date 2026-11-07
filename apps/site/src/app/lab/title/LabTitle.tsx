"use client";

import { useEffect, useRef } from "react";
import type { TitleState } from "@/lib/choreo/title-motion";
import type { FrameManifest } from "@/lib/frames/manifest";
import { createStage } from "@/lib/stage/create-stage";
import { createTitle3D } from "@/lib/title3d/title3d";

export function LabTitle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let cancelled = false;
    let dispose = () => {};
    (async () => {
      const manifest = (await (await fetch("/frames/v1/manifest.json")).json()) as FrameManifest;
      const stage = await createStage(canvas, { manifest, tier: window.innerWidth <= 768 ? "mobile" : "desktop", initialProgress: 0 });
      const title = await createTitle3D({
        text: "SUA MARCA\nEM MOVIMENTO",
        fontUrl: "/fonts/ArchivoBlack-Regular.ttf",
        color: 0xffffff,
        keywordIndex: 3,
        keywordColor: 0xffb339,
      });
      if (cancelled || !stage.scene) return void (stage.dispose(), title.dispose());
      const scale = 0.5;
      title.object.scale.setScalar(scale);
      title.object.position.set(-2.6, -0.6, 0);
      stage.scene.add(title.object);
      await stage.settled();
      stage.render();
      window.__labTitle = {
        size: title.size,
        setState(state: TitleState) {
          title.setState(state);
          stage.render();
        },
        isVisible: () => title.object.visible,
        renderer: stage.renderer,
      };
      dispose = () => {
        title.dispose();
        stage.dispose();
      };
    })();
    return () => {
      cancelled = true;
      dispose();
      delete window.__labTitle;
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 h-full w-full" />;
}
