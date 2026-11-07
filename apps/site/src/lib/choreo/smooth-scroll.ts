import Lenis from "lenis";

let lenis: Lenis | null = null;

/** Liga o scroll suave (Lenis) uma única vez. Com "reduzir movimento" ativado, não liga e devolve `null`. */
export function ensureSmoothScroll(): Lenis | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  if (!lenis) {
    const instance = new Lenis({ lerp: 0.12, smoothWheel: true });
    const raf = (time: number) => {
      instance.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    lenis = instance;
  }
  return lenis;
}

/** Rola até `y` (px do documento), de forma suave se possível. */
export function scrollToY(y: number, opts: { immediate?: boolean } = {}): void {
  const instance = ensureSmoothScroll();
  if (instance) instance.scrollTo(y, { immediate: opts.immediate });
  else window.scrollTo({ top: y });
}
