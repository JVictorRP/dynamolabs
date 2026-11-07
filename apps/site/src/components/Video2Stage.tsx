"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { COPY } from "@/content/copy";
import { TITLE_SIZE_EM } from "@/content/title-sizes";
import { registerHideText } from "@/lib/choreo/debug-hooks";
import { scrollToY } from "@/lib/choreo/smooth-scroll";
import { video2Breather, video2Scrim } from "@/lib/choreo/scrims";
import { video2TitleState } from "@/lib/choreo/title-motion";
import type { FrameManifest } from "@/lib/frames/manifest";
import { createStage } from "@/lib/stage/create-stage";
import { blockPlacement, video2Layout, type Viewport } from "@/lib/stage/layout";
import type { StageHandle } from "@/lib/stage/types";
import { wordIndexOf } from "@/lib/title3d/layout-lines";
import type { Title3D } from "@/lib/title3d/title3d";
import { pickTier } from "@/lib/frames/tier";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { StageShell } from "./StageShell";
import { Video2Static } from "./StaticSections";

const FONT_URL = "/fonts/ArchivoBlack-Regular.ttf";
const GAP = 18;
/** Tamanho medido do título (igual ao do 3D: ver title-sizes.ts), para o texto nascer já no lugar certo. */
const DEFAULT_SIZE: { width: number; height: number } = { ...TITLE_SIZE_EM.video2 };

// Opacidades em função do progresso (--p-video2), em CSS puro.
const P = "var(--p-video2, 0)";
const EYEBROW_OPACITY = `clamp(0, calc((${P} - 0.06) / 0.08), 1)`;
const SUPPORT_OPACITY = `clamp(0, calc((${P} - 0.58) / 0.07), 1)`;
const CTA_OPACITY = `clamp(0, calc((${P} - 0.84) / 0.06), 1)`;
/** Progresso em que o CTA já está inteiro (o foco por teclado leva o scroll até aqui). */
const CTA_PROGRESS = 0.92;

/**
 * Seção 4: o vídeo do celular (a mensagem chegando) controlado pelo scroll. Texto à esquerda, longe do celular e da
 * notificação; o CTA fecha o palco no canto inferior esquerdo.
 */
/** Seção 4: com "reduzir movimento" entra a versão estática (último frame + CTA), sem palco preso. */
export function Video2Stage() {
  const reduced = useReducedMotion();
  return reduced ? <Video2Static /> : <AnimatedVideo2Stage />;
}

function AnimatedVideo2Stage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<StageHandle | null>(null);
  const titleRef = useRef<Title3D | null>(null);
  const progressRef = useRef(0);
  const hiddenRef = useRef(false);
  const [size, setSize] = useState(DEFAULT_SIZE);
  // O palco só é criado (e só baixa frames) quando a seção está a uma tela de distância: não há por que gastar banda e
  // ~160 MB de bitmaps decodificados com um vídeo que ninguém vai ver já na abertura.
  const [started, setStarted] = useState(false);
  // O texto nunca depende do 3D: enquanto o título 3D não está pronto (ou se falhar), o HTML aparece achatado.
  const [titleReady, setTitleReady] = useState(false);
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!readyRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    readyRef.current = { promise, resolve };
  }
  const [vp, setVp] = useState<Viewport | null>(null);
  const [renderer, setRenderer] = useState<StageHandle["renderer"] | null>(null);
  const [ctaOn, setCtaOn] = useState(false);

  const layout = useMemo(() => (vp ? video2Layout(vp, { widthEm: size.width, heightEm: size.height }) : null), [vp, size]);

  const apply = useCallback((p: number) => {
    const title = titleRef.current;
    if (title) {
      title.setState(video2TitleState(p));
      if (hiddenRef.current) title.object.visible = false;
    }
    stageRef.current?.setScrims({ base: 1, hero: 0, s2: 0, breather: video2Breather(p), leftTop: video2Scrim(p) });
  }, []);

  const onProgress = useCallback(
    (p: number) => {
      progressRef.current = p;
      apply(p);
      stageRef.current?.setProgress(p);
      setCtaOn(p >= 0.84);
    },
    [apply],
  );

  // Início preguiçoso: observa a seção e libera a criação do palco perto da hora.
  useEffect(() => {
    const root = rootRef.current!;
    if (typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Gancho de teste: `settle.video2()` espera a criação do palco (que pode demorar por ser preguiçosa) e o quadro assentar.
  useEffect(() => {
    const dyn = (window.__dynamo ??= { progress: {}, history: [] });
    dyn.settle = {
      ...dyn.settle,
      video2: async () => {
        await readyRef.current!.promise;
        await stageRef.current?.settled();
      },
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current!;
    let cancelled = false;
    let teardown = () => {};
    (async () => {
      let stage: StageHandle | null = null;
      let title: Title3D | null = null;
      try {
        const manifest = (await (await fetch("/frames/v2/manifest.json")).json()) as FrameManifest;
        stage = await createStage(canvas, { manifest, tier: pickTier(window.innerWidth, window.innerHeight), initialProgress: progressRef.current });
        if (stage.scene) {
          try {
            const { createTitle3D } = await import("@/lib/title3d/title3d");
            title = await createTitle3D({ text: COPY.video2.title, fontUrl: FONT_URL, color: 0xffffff, keywordIndex: wordIndexOf(COPY.video2.title, COPY.video2.keyword), keywordColor: 0xffb339 });
          } catch {
            title = null; // sem fonte/3D: segue com o vídeo e o título HTML achatado
          }
        }
      } catch {
        // Sem palco (rede, WebGL): o texto HTML e o CTA continuam na tela.
      }
      if (cancelled) {
        stage?.dispose();
        title?.dispose();
        readyRef.current!.resolve();
        return;
      }
      if (!stage) return void readyRef.current!.resolve();
      stageRef.current = stage;
      titleRef.current = title;
      if (title) stage.scene!.add(title.object);
      const live = stage;
      const unregisterHide = registerHideText((hidden) => {
        hiddenRef.current = hidden;
        rootRef.current?.setAttribute("data-text-hidden", String(hidden));
        apply(progressRef.current);
        live.render();
      });
      if (title) setSize(title.size);
      setVp({ w: canvas.clientWidth, h: canvas.clientHeight });
      setRenderer(stage.renderer);
      setTitleReady(Boolean(title));
      readyRef.current!.resolve();
      teardown = () => {
        unregisterHide();
        title?.dispose();
        live.dispose();
      };
    })();
    return () => {
      cancelled = true;
      teardown();
      stageRef.current = null;
      titleRef.current = null;
    };
  }, [apply, started]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const observer = new ResizeObserver(() => setVp({ w: canvas.clientWidth, h: canvas.clientHeight }));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const title = titleRef.current;
    if (!layout || !title || !vp) return;
    const place = blockPlacement(layout, size.height, vp);
    title.object.scale.setScalar(place.scale);
    title.object.position.set(place.x, place.y, 0);
    apply(progressRef.current);
    stageRef.current?.setProgress(progressRef.current);
  }, [layout, size, vp, apply]);

  /** Foco por teclado no CTA enquanto o palco está preso: leva o scroll ao fim do palco, onde o botão aparece. */
  const revealCta = () => {
    const wrapper = rootRef.current?.closest<HTMLElement>("[data-stage]");
    const sticky = wrapper?.querySelector<HTMLElement>("[data-sticky]");
    if (!wrapper || !sticky) return;
    const top = wrapper.getBoundingClientRect().top + window.scrollY;
    scrollToY(top + CTA_PROGRESS * (wrapper.offsetHeight - sticky.offsetHeight), { immediate: true });
  };

  const flat = !titleReady;
  const blockPx = layout ? size.height * layout.fontPx : 0;
  const style = (s: CSSProperties) => s;

  return (
    <StageShell id="video2" pinVh={300} onProgress={onProgress}>
      <div ref={rootRef} data-renderer={renderer ?? "loading"} className="relative h-full w-full bg-void">
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

        {flat && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={style({ background: "radial-gradient(ellipse 62% 50% at 16% 26%, rgba(10,10,10,0.78), rgba(10,10,10,0) 72%), linear-gradient(180deg, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0) 40%, rgba(10,10,10,0.88) 100%)" })} />
        )}

        <h2 className="sr-only">{COPY.video2.title}</h2>
        {layout && (
          <div
            aria-hidden="true"
            data-title="video2"
            className={`absolute m-0 font-display leading-[0.9] font-black tracking-[-0.04em] whitespace-pre uppercase pointer-events-none select-none transition-colors duration-300 ${flat ? "text-white" : "text-transparent"}`}
            style={style({ left: layout.left, bottom: layout.bottom - layout.fontPx * 0.2, fontSize: layout.fontPx, opacity: flat ? EYEBROW_OPACITY : undefined, ...(flat ? { transform: `perspective(900px) rotateX(calc((1 - clamp(0, calc((${P} - 0.02) / 0.16), 1)) * 46deg))`, transformOrigin: "left bottom" } : {}) })}
          >
            {COPY.video2.title}
          </div>
        )}

        {layout && vp && (
          <>
            <p data-copy="video2" className="absolute m-0 font-display font-bold tracking-[0.4em] text-amber uppercase" style={style({ left: layout.left, bottom: layout.bottom + blockPx + GAP, fontSize: Math.max(11, layout.fontPx * 0.2), opacity: EYEBROW_OPACITY })}>
              {COPY.video2.eyebrow}
            </p>
            <p data-copy="video2" className="absolute m-0 font-display font-light text-mist" style={style({ left: layout.left, top: vp.h - layout.bottom + GAP, width: size.width * layout.fontPx, fontSize: Math.min(26, Math.max(15, layout.fontPx * 0.26)), lineHeight: 1.3, opacity: SUPPORT_OPACITY })}>
              {COPY.video2.support}
            </p>
            <a
              data-cta
              href="#contato"
              onFocus={revealCta}
              className="absolute rounded-xl bg-teal px-8 py-4 font-label text-[clamp(10px,1vw,13px)] font-bold tracking-[0.2em] text-graphite uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              style={style({ left: layout.left, bottom: Math.max(28, vp.h * 0.09), opacity: CTA_OPACITY, pointerEvents: ctaOn ? "auto" : "none" })}
            >
              {COPY.video2.cta}
            </a>
          </>
        )}
      </div>
    </StageShell>
  );
}
