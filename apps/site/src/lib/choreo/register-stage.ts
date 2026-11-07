import { damp } from "../scroll/math";
import { ensureSmoothScroll } from "./smooth-scroll";
import { stageEdge, stageProgress, stageWrapperHeight } from "./stage-progress";

export type StageId = "hero-s2" | "chat" | "video2";

/** Janela inicial em que o progresso segue o scroll sem suavização (cobre a restauração de scroll ao recarregar). */
const SNAP_MS = 800;
const DAMP_LAMBDA = 14;
const HISTORY_CAP = 500;

const listeners = new Set<() => void>();

/** Avisa quando qualquer palco publica um novo progresso (alimenta `useSiteProgress`). */
export function subscribeProgress(callback: () => void): () => void {
  listeners.add(callback);
  return () => void listeners.delete(callback);
}

/** Último progresso publicado por um palco (0 se ainda não existe). */
export function getStageProgress(id: StageId): number {
  return typeof window === "undefined" ? 0 : (window.__dynamo?.progress[id] ?? 0);
}

/** Último topo publicado de um palco (1 se ainda não existe: abaixo da tela). */
export function getStageEdge(id: StageId): number {
  return typeof window === "undefined" ? 1 : (window.__dynamo?.edge?.[id] ?? 1);
}

/** Lê o progresso atual do palco a partir do layout. `wrapper` contém um elemento `[data-sticky]`. */
export function measureStageProgress(wrapper: HTMLElement): number {
  const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]") ?? wrapper;
  return stageProgress(wrapper.getBoundingClientRect().top, wrapper.getBoundingClientRect().height, sticky.getBoundingClientRect().height);
}

/**
 * Liga um palco ao scroll: a cada quadro mede o progresso, suaviza e o publica em
 * `--p-<id>` (variável CSS), `window.__dynamo.progress[id]` e `onProgress`.
 * Devolve a função de limpeza.
 */
export function registerStage(el: HTMLElement, opts: { id: StageId; pinVh: number; onProgress: (p: number) => void }): () => void {
  ensureSmoothScroll();
  el.style.height ||= stageWrapperHeight(opts.pinVh);
  const dyn = (window.__dynamo ??= { progress: {}, history: [] });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const born = performance.now();
  let last = born;
  let current = measureStageProgress(el);
  let emitted = Number.NaN;
  let emittedEdge = Number.NaN;
  let raf = 0;

  const emit = (p: number) => {
    // A seção que desliza por cima da anterior se move com o progresso parado em 0: o topo também é uma mudança a publicar.
    const edge = stageEdge(el.getBoundingClientRect().top, window.innerHeight);
    if (Math.abs(p - emitted) < 1e-5 && Math.abs(edge - emittedEdge) < 1e-4) return;
    emitted = p;
    emittedEdge = edge;
    (dyn.edge ??= {})[opts.id] = edge;
    el.style.setProperty(`--p-${opts.id}`, p.toFixed(5));
    dyn.progress[opts.id] = p;
    dyn.history.push(p);
    if (dyn.history.length > HISTORY_CAP) dyn.history.shift();
    opts.onProgress(p);
    listeners.forEach((notify) => notify());
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const target = measureStageProgress(el);
    const snap = reduced || now - born < SNAP_MS || Math.abs(target - current) < 0.0004;
    current = snap ? target : damp(current, target, DAMP_LAMBDA, dt);
    emit(current);
  };

  emit(current);
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
