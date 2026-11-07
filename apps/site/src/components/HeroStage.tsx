"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { COPY } from "@/content/copy";
import { TITLE_SIZE_EM } from "@/content/title-sizes";
import { registerHideText } from "@/lib/choreo/debug-hooks";
import { breather, heroScrim, s2Scrim } from "@/lib/choreo/scrims";
import { heroTitleState, s2TitleState } from "@/lib/choreo/title-motion";
import type { FrameManifest } from "@/lib/frames/manifest";
import { blockPlacement, heroLayout, s2Layout, type BlockLayout, type Viewport } from "@/lib/stage/layout";
import { createStage } from "@/lib/stage/create-stage";
import type { StageHandle } from "@/lib/stage/types";
import { wordIndexOf } from "@/lib/title3d/layout-lines";
import type { Title3D } from "@/lib/title3d/title3d";
import { pickTier } from "@/lib/frames/tier";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import heroManifest from "../../public/frames/v1/manifest.json";
import { DecoText } from "./DecoText";
import { HeroStatic, Section2Static } from "./StaticSections";
import { StageShell } from "./StageShell";

const FONT_URL = "/fonts/ArchivoBlack-Regular.ttf";
const GAP = 18; // px entre o bloco 3D e o texto HTML vizinho

// Opacidades em função do progresso (--p-hero-s2, 0–1), em CSS puro: sem estado de animação.
const P = "var(--p-hero-s2, 0)";
const HERO_OPACITY = `clamp(0, calc((0.45 - ${P}) / 0.2), 1)`;
const CUE_OPACITY = `clamp(0, calc((0.12 - ${P}) / 0.08), 1)`;
const S2_EYEBROW_OPACITY = `clamp(0, calc((${P} - 0.5) / 0.08), 1)`;
const S2_BODY_OPACITY = `clamp(0, calc((${P} - 0.56) / 0.07), 1)`;
// Fallback sem WebGL: o mesmo movimento dos títulos 3D (dobra do hero, subida da seção 2), em CSS 3D puro.
const HERO_FOLD_3D = `perspective(900px) rotateX(calc(clamp(0, calc((${P} - 0.25) / 0.2), 1) * -69deg))`;
const S2_RISE_3D = `perspective(900px) rotateX(calc((1 - clamp(0, calc((${P} - 0.45) / 0.15), 1)) * 46deg))`;
const BREATHER = `clamp(0, calc((${P} - 0.92) / 0.08), 1)`;

type Sizes = { hero: { width: number; height: number }; s2: { width: number; height: number } };
/** Tamanhos medidos dos títulos (iguais aos do 3D: ver title-sizes.ts), para o texto nascer já no lugar certo. */
const DEFAULT_SIZES: Sizes = { hero: { ...TITLE_SIZE_EM.hero }, s2: { ...TITLE_SIZE_EM.s2 } };
const POSTER_VERSION = (heroManifest as { version?: string }).version ?? "";
type Layouts = { vp: Viewport; hero: BlockLayout; s2: BlockLayout };

const style = (s: CSSProperties) => s;

/** Hero + seção 2: com "reduzir movimento" entram as versões estáticas, sem palco preso. */
export function HeroStage() {
  const reduced = useReducedMotion();
  return reduced ? (
    <>
      <HeroStatic />
      <Section2Static />
    </>
  ) : (
    <AnimatedHeroStage />
  );
}

function AnimatedHeroStage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<StageHandle | null>(null);
  const titlesRef = useRef<{ hero: Title3D; s2: Title3D } | null>(null);
  const progressRef = useRef(0);
  const hiddenRef = useRef(false);
  const [sizes, setSizes] = useState<Sizes>(DEFAULT_SIZES);
  const [vp, setVp] = useState<Viewport | null>(null);
  const [renderer, setRenderer] = useState<StageHandle["renderer"] | null>(null);
  // Enquanto o título 3D não está pronto (ou se ele falhar), o título HTML aparece achatado: o texto nunca depende do 3D.
  const [titlesReady, setTitlesReady] = useState(false);

  const layouts: Layouts | null = useMemo(
    () => (vp ? { vp, hero: heroLayout(vp, { widthEm: sizes.hero.width }), s2: s2Layout(vp, { widthEm: sizes.s2.width, heightEm: sizes.s2.height }) } : null),
    [vp, sizes],
  );

  /** Aplica aos dois títulos 3D o estado do progresso atual (e respeita o gancho de teste que esconde o texto). */
  const apply = useCallback((p: number) => {
    const titles = titlesRef.current;
    if (!titles) return;
    const hero = heroTitleState(p);
    const s2 = s2TitleState(p);
    titles.hero.setState(hero);
    titles.s2.setState(s2);
    if (hiddenRef.current) titles.hero.object.visible = titles.s2.object.visible = false;
    if (window.__dynamo) window.__dynamo.titles = { hero, s2 };
    // Os véus pretos são desenhados no WebGL, entre o vídeo e os títulos (em HTML por cima escureceriam o texto).
    stageRef.current?.setScrims({ base: 1, hero: heroScrim(p), s2: s2Scrim(p), breather: breather(p), leftTop: 0 });
  }, []);

  const onProgress = useCallback(
    (p: number) => {
      progressRef.current = p;
      apply(p);
      stageRef.current?.setProgress(p);
    },
    [apply],
  );

  // Cria o palco WebGL e os dois títulos 3D (Three.js e a fonte só são baixados aqui).
  useEffect(() => {
    const canvas = canvasRef.current!;
    let cancelled = false;
    let teardown = () => {};
    (async () => {
      let stage: StageHandle | null = null;
      let titles: { hero: Title3D; s2: Title3D } | null = null;
      try {
        const manifest = (await (await fetch("/frames/v1/manifest.json")).json()) as FrameManifest;
        stage = await createStage(canvas, { manifest, tier: pickTier(window.innerWidth, window.innerHeight), initialProgress: progressRef.current });
        if (stage.scene) {
          try {
            const { createTitle3D } = await import("@/lib/title3d/title3d");
            const hero = await createTitle3D({ text: COPY.hero.title, fontUrl: FONT_URL, color: 0xffffff, keywordIndex: wordIndexOf(COPY.hero.title, COPY.hero.keyword), keywordColor: 0xffb339 });
            try {
              const s2 = await createTitle3D({ text: COPY.s2.title, fontUrl: FONT_URL, color: 0xffffff, keywordIndex: wordIndexOf(COPY.s2.title, COPY.s2.keyword), keywordColor: 0xffb339 });
              titles = { hero, s2 };
            } catch {
              hero.dispose();
            }
          } catch {
            titles = null; // sem fonte/3D: segue com o vídeo e o título HTML achatado
          }
        }
      } catch {
        // Sem palco (rede, WebGL): o poster e os textos HTML continuam na tela.
      }
      if (cancelled) {
        stage?.dispose();
        titles?.hero.dispose();
        titles?.s2.dispose();
        return;
      }
      if (!stage) return;
      stageRef.current = stage;
      titlesRef.current = titles;
      if (titles) stage.scene!.add(titles.hero.object, titles.s2.object);
      const dyn = (window.__dynamo ??= { progress: {}, history: [] });
      const live = stage;
      dyn.settle = { ...dyn.settle, "hero-s2": () => live.settled() };
      const unregisterHide = registerHideText((hidden) => {
        hiddenRef.current = hidden;
        rootRef.current?.setAttribute("data-text-hidden", String(hidden));
        apply(progressRef.current);
        live.render();
      });
      if (titles) setSizes({ hero: titles.hero.size, s2: titles.s2.size });
      setVp({ w: canvas.clientWidth, h: canvas.clientHeight });
      setRenderer(stage.renderer);
      setTitlesReady(Boolean(titles));
      teardown = () => {
        unregisterHide();
        titles?.hero.dispose();
        titles?.s2.dispose();
        live.dispose();
      };
    })();
    return () => {
      cancelled = true;
      teardown();
      stageRef.current = null;
      titlesRef.current = null;
    };
  }, [apply]);

  // Acompanha o tamanho do palco para recalcular o layout.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const observer = new ResizeObserver(() => setVp({ w: canvas.clientWidth, h: canvas.clientHeight }));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Posiciona os títulos 3D a partir do mesmo layout que posiciona o HTML ao redor.
  useEffect(() => {
    const titles = titlesRef.current;
    if (!layouts || !titles) return;
    (["hero", "s2"] as const).forEach((key) => {
      const place = blockPlacement(layouts[key], sizes[key].height, layouts.vp);
      titles[key].object.scale.setScalar(place.scale);
      titles[key].object.position.set(place.x, place.y, 0);
    });
    apply(progressRef.current);
    stageRef.current?.setProgress(progressRef.current);
  }, [layouts, sizes, apply]);

  const flat = !titlesReady; // sem título 3D (ainda, ou nunca: sem WebGL, sem fonte) o HTML aparece achatado
  const mirror = (l: BlockLayout, opacity: string, transform?: string): CSSProperties => ({
    left: l.left,
    bottom: l.bottom - l.fontPx * 0.2,
    fontSize: l.fontPx,
    opacity: flat ? opacity : undefined,
    ...(flat ? { transform, transformOrigin: "left bottom" } : {}),
  });
  const mirrorClass = `absolute m-0 font-display leading-[0.9] font-black tracking-[-0.04em] whitespace-pre uppercase pointer-events-none select-none transition-colors duration-300 ${flat ? "text-white" : "text-transparent"}`;

  const hero = layouts?.hero;
  const s2 = layouts?.s2;
  const s2BlockPx = s2 ? sizes.s2.height * s2.fontPx : 0;

  return (
    <StageShell id="hero-s2" pinVh={450} onProgress={onProgress}>
      <div
        ref={rootRef}
        data-renderer={renderer ?? "loading"}
        className="hero-vars relative h-full w-full bg-void"
        style={hero ? ({ "--hero-fs": `${hero.fontPx}px`, "--hero-left": `${hero.left}px`, "--hero-bottom": `${hero.bottom}px` } as CSSProperties) : undefined}
      >
        {/* Primeiro frame no HTML: aparece com a página e fica SEMPRE atrás do canvas, que o cobre quando desenha. Nunca o
            escondemos antes disso: esconder deixaria a tela preta enquanto o canvas ainda carrega. */}
        <picture aria-hidden="true">
          <source media="(max-width: 768px)" srcSet={`/frames/v1/poster-mobile.webp?v=${POSTER_VERSION}`} />
          <img src={`/frames/v1/poster-desktop.webp?v=${POSTER_VERSION}`} alt="" fetchPriority="high" decoding="async" className="hero-poster absolute inset-0 h-full w-full object-cover object-[96%_50%]" />
        </picture>
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

        {/* Com o texto em HTML achatado os véus pretos (só preto, regra do DS) vão em HTML por cima do canvas; com o 3D pronto, quem desenha os véus é o WebGL. */}
        {flat && (
          <>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={style({ background: "radial-gradient(ellipse at 60% 40%, rgba(10,10,10,0) 35%, rgba(10,10,10,0.88) 100%), linear-gradient(180deg, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0) 40%, rgba(10,10,10,0.88) 100%)" })} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={style({ opacity: HERO_OPACITY, background: "radial-gradient(ellipse 75% 62% at 12% 100%, rgba(10,10,10,0.82), rgba(10,10,10,0) 70%)" })} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={style({ opacity: `clamp(0, calc((${P} - 0.4) / 0.15), 1)`, background: "radial-gradient(ellipse 60% 75% at 92% 50%, rgba(10,10,10,0.75), rgba(10,10,10,0) 72%)" })} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-void" style={style({ opacity: `calc(${BREATHER} * 0.92)` })} />

          </>
        )}

        {/* Hero: bloco no canto inferior esquerdo */}
        {/* O título real fica SEMPRE sr-only (leitores de tela e SEO, nunca se move). A cópia visual (aria-hidden) só passa a
            existir quando o layout está pronto: inserida, não deslocada (mover uma caixa já pintada seria layout shift). */}
        <h1 className="sr-only">{COPY.hero.title}</h1>
        <div
          aria-hidden="true"
          data-title="hero"
          className={mirrorClass}
          style={style({
            left: "var(--hero-left)",
            bottom: "calc(var(--hero-bottom) - 0.2 * var(--hero-fs))",
            fontSize: "var(--hero-fs)",
            ...(flat ? { opacity: HERO_OPACITY, transform: HERO_FOLD_3D, transformOrigin: "left bottom" } : {}),
          })}
        >
          {COPY.hero.title}
        </div>
        <div
          data-copy="hero"
          className="absolute flex flex-col gap-[10px]"
          style={style({ left: "var(--hero-left)", bottom: `calc(var(--hero-bottom) + ${TITLE_SIZE_EM.hero.height} * var(--hero-fs) + ${GAP}px)`, opacity: HERO_OPACITY })}
        >
          <p className="eyebrow m-0 font-display font-bold text-amber uppercase">
            {COPY.hero.eyebrow}
          </p>
          <p className="m-0 font-display font-light text-gray-300 italic" style={style({ fontSize: "calc(0.32 * var(--hero-fs))", lineHeight: 1 })}>
            {COPY.hero.support}
          </p>
        </div>
        <DecoText lines={COPY.hero.deco} style={style({ left: "var(--hero-left)", top: 104, opacity: HERO_OPACITY })} />
        <p
          data-copy="cue"
          className="absolute m-0 flex items-center gap-3 font-display text-[clamp(10px,1.1vw,14px)] font-medium tracking-[0.22em] text-gray-300 uppercase"
          style={style({ left: "var(--hero-left)", bottom: "max(20px, calc(var(--hero-bottom) * 0.4))", opacity: CUE_OPACITY })}
        >
          <span className="inline-block size-[6px] rounded-full bg-teal" />
          {COPY.hero.cue}
        </p>

        {/* Seção 2: bloco à direita, oposto ao assunto (o caderno) */}
        <h2 className="sr-only">{COPY.s2.title}</h2>
        {s2 && (
          <div aria-hidden="true" data-title="s2" className={mirrorClass} style={mirror(s2, S2_EYEBROW_OPACITY, S2_RISE_3D)}>
            {COPY.s2.title}
          </div>
        )}
        {s2 && (
          <>
            <p data-copy="s2" className="eyebrow absolute m-0 font-display font-bold text-amber uppercase" style={style({ left: s2.left, bottom: s2.bottom + s2BlockPx + GAP, opacity: S2_EYEBROW_OPACITY })}>
              {COPY.s2.eyebrow}
            </p>
            <p data-copy="s2" className="absolute m-0 font-display font-light text-mist" style={style({ left: s2.left, top: layouts!.vp.h - s2.bottom + GAP, width: sizes.s2.width * s2.fontPx, fontSize: Math.min(26, Math.max(15, s2.fontPx * 0.26)), lineHeight: 1.3, opacity: S2_BODY_OPACITY })}>
              {COPY.s2.body}
            </p>
            <DecoText lines={COPY.s2.deco} style={style({ left: layouts!.s2.left - sizes.s2.width * s2.fontPx * 0.55, top: 104, opacity: S2_EYEBROW_OPACITY })} />
          </>
        )}
      </div>
    </StageShell>
  );
}
