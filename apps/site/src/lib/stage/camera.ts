/** Câmera do palco WebGL: o plano z = 0 é onde os títulos 3D "assentam". */
export const CAMERA_FOV_DEG = 35;
export const CAMERA_Z = 6;

/** Quantas unidades da cena cabem em 1 px do viewport no plano z = 0. */
export function unitsPerPx(viewportHeightPx: number): number {
  const visibleHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV_DEG / 2) * (Math.PI / 180));
  return visibleHeight / viewportHeightPx;
}
