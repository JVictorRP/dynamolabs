/**
 * Maior retângulo de `src` com a proporção de `dst` (modo "cover"), centrado no ponto de foco
 * (0–1) e preso às bordas de `src`.
 */
export function coverRect(
  src: { w: number; h: number },
  dst: { w: number; h: number },
  focus: { x: number; y: number },
): { sx: number; sy: number; sw: number; sh: number } {
  const dstAspect = dst.w / dst.h;
  const srcAspect = src.w / src.h;
  const sw = dstAspect < srcAspect ? src.h * dstAspect : src.w;
  const sh = dstAspect < srcAspect ? src.h : src.w / dstAspect;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  return {
    sx: clamp(focus.x * src.w - sw / 2, src.w - sw),
    sy: clamp(focus.y * src.h - sh / 2, src.h - sh),
    sw,
    sh,
  };
}
