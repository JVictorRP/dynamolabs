import type { PerspectiveCamera, Scene } from "three";
import type { Scrims } from "../choreo/scrims";
import type { FrameManifest, Tier } from "../frames/manifest";

export type Crop = { sx: number; sy: number; sw: number; sh: number };

/** O que desenhar para um progresso: par de frames, mistura e recorte (em pixels do frame de origem). */
export type DrawPlan = { index: number; next: number; mix: number; crop: Crop };

/** Desenha dois frames misturados dentro de um canvas. */
export interface StageRenderer {
  resize(width: number, height: number, dpr: number): void;
  draw(a: ImageBitmap, b: ImageBitmap, mix: number, crop: Crop): void;
  dispose(): void;
}

export interface StageOptions {
  manifest: FrameManifest;
  tier: Tier;
  forceCanvas2d?: boolean;
  /** 2 = economia de dados (um frame sim, outro não). */
  stride?: 1 | 2;
  /** Progresso inicial: o primeiro frame carregado é o dessa posição, não o frame 0. */
  initialProgress?: number;
}

export interface StageHandle {
  setProgress(p: number): void;
  resize(): void;
  dispose(): void;
  renderer: "webgl" | "canvas2d";
  /** Cena e câmera do renderer WebGL, onde os títulos 3D são adicionados. `null` no canvas 2D. */
  scene: Scene | null;
  camera: PerspectiveCamera | null;
  /** Véus pretos entre o vídeo e os títulos (só no WebGL; no canvas 2D o chamador usa HTML). */
  setScrims(scrims: Scrims): void;
  /** Redesenha agora (usado depois de mudar objetos 3D da cena). */
  render(): void;
  /** Resolve quando os frames da janela atual chegaram e o quadro foi desenhado. */
  settled(): Promise<void>;
  readonly lastDraw: DrawPlan | null;
}
