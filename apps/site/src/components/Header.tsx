"use client";

import { headerState, type HeaderVariant, type SiteProgress } from "@/lib/choreo/header-state";

export type NavLink = { href: string; label: string };

/** Altura visual (px) de cada variante. O menu tem sempre `FULL_HEIGHT` de layout e varia só por `transform`: mexer na altura mudaria a posição dos itens a cada quadro (layout shift). */
const FULL_HEIGHT = 80;
const VARIANT: Record<HeaderVariant, { height: number; bar: string; text: string }> = {
  transparent: { height: 80, bar: "bg-transparent", text: "text-white" },
  glass: { height: 64, bar: "bg-void/55 backdrop-blur-md", text: "text-white" },
  compact: { height: 56, bar: "bg-void/70 backdrop-blur-md", text: "text-white" },
  light: { height: 56, bar: "bg-white/70 backdrop-blur-md", text: "text-graphite" },
  "dark-glass": { height: 56, bar: "bg-void/60 backdrop-blur-md", text: "text-white" },
};

/**
 * Menu fixo. Sua aparência é função da seção e do progresso (`headerState`).
 * O logo troca entre os dois arquivos oficiais (claro/grafite), nunca por filtro CSS; os dois ficam
 * no DOM (sem espera de rede na troca) e só o ativo aparece.
 */
export function Header({ progress, links, cta }: { progress: SiteProgress; links: NavLink[]; cta?: NavLink }) {
  const state = headerState(progress);
  const logo = (kind: "claro" | "grafite") => (
    <img
      src={`/brand/dynamo-simbolo-${kind}.png`}
      alt=""
      data-active={state.logo === kind}
      aria-hidden={state.logo !== kind}
      className={`absolute inset-0 h-full w-full object-contain object-left transition-opacity duration-300 ${state.logo === kind ? "opacity-100" : "opacity-0"}`}
    />
  );

  const look = VARIANT[state.variant];
  return (
    <header
      data-variant={state.variant}
      data-logo={state.logo}
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 transition-colors duration-500 ease-out ${look.text}`}
      style={{ height: FULL_HEIGHT }}
    >
      {/* Fundo: a altura visual vem de scaleY (transform não gera layout shift). */}
      <div
        aria-hidden="true"
        className={`pointer-events-auto absolute inset-x-0 top-0 origin-top transition-[transform,background-color] duration-500 ease-out ${look.bar}`}
        style={{ height: FULL_HEIGHT, transform: `scaleY(${look.height / FULL_HEIGHT})` }}
      />
      {/* Conteúdo: sobe o necessário para ficar centrado na altura visual. */}
      <div
        className="pointer-events-auto relative flex items-center justify-between px-6 transition-transform duration-500 ease-out md:px-10"
        style={{ height: FULL_HEIGHT, transform: `translateY(${-(FULL_HEIGHT - look.height) / 2}px)` }}
      >
        <a href="#top" aria-label="Dynamo, início" className="relative block h-7 w-9 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current">
          {logo("claro")}
          {logo("grafite")}
        </a>
        <nav aria-label="Principal" className="hidden items-center gap-10 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-display text-[0.7rem] font-bold tracking-[0.4em] uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
            >
              {link.label}
            </a>
          ))}
        </nav>
        {cta ? (
          <a
            href={cta.href}
            className="rounded-lg bg-teal px-5 py-2 font-label text-[0.65rem] font-bold tracking-[0.2em] text-graphite uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          >
            {cta.label}
          </a>
        ) : null}
      </div>
      {/* Indicador de progresso do vídeo, colado na borda de baixo da altura visual. */}
      <div
        data-indicator
        aria-hidden="true"
        className="absolute top-0 left-0 h-px w-full origin-left bg-teal"
        style={{ transform: `translateY(${look.height - 1}px) scaleX(${state.indicator})` }}
      />
    </header>
  );
}
