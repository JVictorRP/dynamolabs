import type { FrameManifest, Tier } from "../frames/manifest";
import { coverRect } from "../scroll/crop";
import { interpolateFocus, progressToFrame } from "../scroll/math";
import type { DrawPlan } from "./types";

/** Para um progresso (0–1) e o tamanho do canvas, decide o par de frames, a mistura e o recorte. */
export function planDraw(manifest: FrameManifest, tier: Tier, progress: number, dst: { w: number; h: number }): DrawPlan {
  const { index, next, mix } = progressToFrame(progress, manifest.frames);
  const { width, height } = manifest.tiers[tier];
  const focus = interpolateFocus(manifest.focus, progress);
  return { index, next, mix, crop: coverRect({ w: width, h: height }, dst, focus) };
}
