"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import GlassSurface from "./ui/GlassSurface";

type Service = { name: string; text: string };

const LEAVE_DELAY_MS = 160;
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Menu de serviços da seção 2: os nomes ficam onde antes estava o texto da seção; o serviço escolhido (mouse, foco ou toque)
 * traz à frente o card de vidro líquido dele, na metade de cima da tela, e os outros cards esmaecem.
 *
 * - O controle é o menu. Os cards são só visuais (`pointer-events-none`), então o mouse nunca "briga" com o card que cobre os vizinhos.
 * - Cada botão aponta para o texto do serviço por `aria-describedby`: quem usa leitor de tela ouve a descrição ao focar.
 * - Fora da seção (`live=false`) tudo fica `inert`: sem foco, sem mouse, sem leitor de tela.
 */
export function ServicesPanel({
  label,
  services,
  live,
  portrait = false,
  menuStyle,
  deckStyle,
  fontSize = 18,
}: {
  label: string;
  services: readonly Service[];
  live: boolean;
  portrait?: boolean;
  menuStyle?: CSSProperties;
  deckStyle?: CSSProperties;
  fontSize?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const baseId = useId();
  const count = services.length;

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const choose = useCallback(
    (i: number) => {
      cancelLeave();
      setActive(i);
    },
    [cancelLeave],
  );
  const scheduleLeave = useCallback(() => {
    cancelLeave();
    leaveTimer.current = setTimeout(() => setActive(null), LEAVE_DELAY_MS);
  }, [cancelLeave]);

  useEffect(() => {
    if (!live) {
      cancelLeave();
      setActive(null);
    }
  }, [live, cancelLeave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    const onOutside = (e: Event) => {
      if (root.current && !root.current.contains(e.target as Node)) setActive(null); // toque fora do menu fecha o card
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      cancelLeave();
    };
  }, [cancelLeave]);

  // Em tela vertical o deck só aparece com um serviço escolhido (o título da seção ocupa o terço de cima).
  const deckHidden = portrait && active === null;
  const stepPct = count > 1 ? 50 / (count - 1) : 0; // os cards se empilham em degraus de 1/8 da altura; o card da frente tem metade dela

  return (
    <>
      <nav ref={root} aria-label={label} inert={!live} className="absolute" style={{ ...menuStyle, zIndex: 40 }}>
        <ul className="m-0 flex list-none flex-col p-0" style={{ gap: Math.round(fontSize * 0.35) }}>
          {services.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                data-service-button={i}
                data-active={active === i ? "" : undefined}
                aria-describedby={`${baseId}-t${i}`}
                onPointerEnter={(e) => e.pointerType !== "touch" && choose(i)}
                onPointerLeave={(e) => e.pointerType !== "touch" && scheduleLeave()}
                onFocus={() => choose(i)}
                onBlur={scheduleLeave}
                onClick={() => choose(i)}
                className="group flex w-full cursor-pointer items-baseline gap-3 border-0 bg-transparent p-0 text-left font-display font-light text-white transition-opacity duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                style={{ fontSize, lineHeight: 1.25, opacity: active === null || active === i ? 1 : 0.45 }}
              >
                <span aria-hidden="true" className="font-label text-[0.6em] font-bold tracking-[0.2em] text-amber tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="border-b border-transparent pb-[0.1em] transition-colors duration-300 group-data-[active]:border-amber">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div data-service-deck aria-hidden="true" inert={!live} className="pointer-events-none absolute" style={{ ...deckStyle, opacity: deckHidden ? 0 : (deckStyle?.opacity ?? 1), transition: `opacity 0.35s ease` }}>
        {services.map((s, i) => {
          const state = active === null ? "rest" : active === i ? "active" : "dim";
          const transform = state === "active" ? "translateY(-3%) scale(1.035)" : state === "dim" ? "scale(0.965)" : "none";
          return (
            <div
              key={s.name}
              data-service-card={i}
              data-state={state}
              className="absolute inset-x-0"
              style={{
                top: `${i * stepPct}%`,
                height: "50%",
                zIndex: state === "active" ? count + 1 : i + 1,
                opacity: state === "active" ? 1 : state === "dim" ? 0.2 : 0.7,
                transform,
                transformOrigin: "50% 100%",
                transition: `transform 0.5s ${EASE}, opacity 0.35s ease`,
                willChange: "transform, opacity",
              }}
            >
              <GlassSurface width="100%" height="100%" borderRadius={22} blur={14} brightness={55} opacity={0.9} displace={0.6} backgroundOpacity={state === "active" ? (portrait ? 0.78 : 0.42) : 0.1} saturation={1.25}>
                <div className="flex h-full w-full flex-col justify-between p-[clamp(10px,1.3vw,20px)] text-left transition-opacity duration-300" style={{ opacity: state === "dim" ? 0 : 1 }}>
                  <p className="m-0 flex items-baseline gap-3 font-display text-[clamp(13px,1.15vw,17px)] font-bold tracking-[0.04em] text-white uppercase">
                    <span className="font-label text-[0.62em] tracking-[0.2em] text-amber tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    {s.name}
                  </p>
                  <p className="m-0 font-display text-[clamp(12px,1.05vw,16px)] leading-[1.35] font-light text-mist transition-opacity duration-300" style={{ opacity: state === "active" ? 1 : 0 }}>
                    {s.text}
                  </p>
                </div>
              </GlassSurface>
            </div>
          );
        })}
      </div>

      {/* Descrições sempre no DOM (escondidas), para o aria-describedby de cada botão. */}
      <div hidden>
        {services.map((s, i) => (
          <span key={s.name} id={`${baseId}-t${i}`}>
            {s.text}
          </span>
        ))}
      </div>
    </>
  );
}
