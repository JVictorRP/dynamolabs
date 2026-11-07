import type { CSSProperties } from "react";

/**
 * Texto decorativo (Oxanium Light): textura, nunca informação. Caixa alta, tracking 0,6em, branco a 27%,
 * quadrado de 7px antes de cada frase e esmaecimento abrupto para a direita (nítido no primeiro terço).
 */
export function DecoText({ lines, style, className = "" }: { lines: readonly string[]; style?: CSSProperties; className?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ ...style, maskImage: "linear-gradient(90deg, #000 33%, transparent 66%)", WebkitMaskImage: "linear-gradient(90deg, #000 33%, transparent 66%)" }}
      className={`pointer-events-none absolute font-deco text-[clamp(10px,1.25vw,18px)] leading-[1.7] font-light tracking-[0.6em] whitespace-nowrap text-deco-ink uppercase ${className}`}
    >
      {lines.map((line) => (
        <p key={line} className="flex items-center gap-[14px]">
          <span className="inline-block size-[7px] shrink-0 bg-deco-ink" />
          {line}
        </p>
      ))}
    </div>
  );
}
