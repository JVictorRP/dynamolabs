"use client";

import { useState, type PointerEvent } from "react";
import { useCopy } from "./LocaleProvider";
import { CHAT_FROM, CHAT_TO, visibleChat } from "@/lib/choreo/chat-script";
import { layerOffset, pointerTilt } from "@/lib/choreo/parallax";
import { STAGE_OVERLAP_VH } from "@/lib/choreo/overlap";
import { easeInOutCubic, segment } from "@/lib/scroll/math";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { StageShell } from "./StageShell";

/** Quanto de "rolagem virtual" (px) as camadas de paralaxe percorrem ao longo do palco. */
const PARALLAX_PX = 700;

/** Em que parte do palco o texto da seção termina de entrar. */
const TEXT_IN = 0.1;

/**
 * Seção do chatbot: um cartão branco que desliza por cima da seção 2 (o celular já aparece na parte de baixo antes de
 * a anterior acabar) e sai coberto pelo vídeo 2. Fundo com paralaxe em três camadas e um celular cuja conversa avança,
 * mensagem a mensagem, com o scroll. Tudo é função do progresso do palco.
 */
export function ChatSection() {
  const copy = useCopy();
  const reduced = useReducedMotion();
  const [p, setP] = useState(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const progress = reduced ? 0.5 : p;
  const content = segment(progress, CHAT_FROM, CHAT_TO); // progresso da conversa
  const { shown, typing } = reduced ? { shown: copy.chat.messages, typing: null } : visibleChat(copy.chat.messages, content);

  const enter = reduced ? 1 : easeInOutCubic(segment(progress, 0, TEXT_IN)); // o texto já está na tela quando o cartão chega; só se assenta (dobra → reto)

  // Cada camada anda numa velocidade; no meio do palco (p = 0,5) fica na posição-base.
  const layerY = (speed: number) => (reduced ? 0 : -(layerOffset(progress * PARALLAX_PX, speed) - layerOffset(PARALLAX_PX / 2, speed)));
  const cardOpacity = (at: number) => (reduced ? 1 : segment(content, at - 0.03, at + 0.03));

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt(pointerTilt(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), 6));
  };

  return (
    <StageShell id="chat" pinVh={reduced ? 0 : 350} onProgress={setP} overlapVh={reduced ? 0 : STAGE_OVERLAP_VH} edge="light" zIndex={20}>
      <div
        id="chatbot"
        className="relative h-full w-full overflow-hidden bg-white text-graphite"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setTilt({ rx: 0, ry: 0 })}
      >
        {/* Paralaxe: fundo (marca d'água e forma), meio (monograma e cartões) e frente (pontos desfocados). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ perspective: 1200 }}>
          <div className="absolute inset-0" style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transformStyle: "preserve-3d" }}>
            <div className="absolute inset-0" style={{ transform: `translateY(${layerY(0.85)}px)` }}>
              <span className="absolute font-display leading-[0.8] font-black tracking-[-0.04em] text-gray-100 select-none" style={{ right: "3%", top: "10%", fontSize: "clamp(160px, 34vw, 520px)" }}>
                {copy.chat.watermark}
              </span>
              <span className="absolute rounded-full bg-gray-100" style={{ left: "-8%", bottom: "-14%", width: "36vw", height: "36vw" }} />
            </div>
            <div className="absolute inset-0" style={{ transform: `translateY(${layerY(0.55)}px)` }}>
              <img src="/brand/dynamo-simbolo-grafite.png" alt="" className="absolute hidden w-14 md:block" style={{ left: "6%", top: "88%" }} />
              {copy.chat.cards.map((card, i) => (
                <div
                  key={card.label}
                  className={`absolute hidden rounded-lg bg-gray-100 px-4 py-3 md:block ${i === 0 ? "md:left-[50%] md:top-[64%]" : "md:left-[53%] md:top-[12%]"}`}
                  style={{ opacity: cardOpacity(card.at), transform: `translateY(${(1 - cardOpacity(card.at)) * 14}px)` }}
                >
                  <p className="m-0 flex items-center gap-2 font-label text-[10px] font-bold tracking-[0.2em] text-graphite">
                    <span className="inline-block size-[7px] rounded-full bg-teal" />
                    {card.label}
                  </p>
                  <p className="m-0 mt-1 font-display text-xs text-gray-700">{card.detail}</p>
                </div>
              ))}
            </div>
            <div className="absolute inset-0" style={{ transform: `translateY(${layerY(0.25)}px)` }}>
              <span className="absolute hidden rounded-full bg-teal blur-[6px] md:block" style={{ left: "30%", top: "12%", width: 22, height: 22 }} />
              <span className="absolute rounded-full bg-teal blur-[8px]" style={{ left: "92%", top: "64%", width: 30, height: 30 }} />
              <span className="absolute rounded-full bg-graphite blur-[5px]" style={{ left: "58%", top: "88%", width: 14, height: 14 }} />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-6 pt-[72px] pb-6 md:flex-row md:justify-between md:gap-12 md:px-[8vw]">
          <div className="self-start md:self-center" style={{ transform: `perspective(900px) rotateX(${(1 - enter) * 28}deg)`, transformOrigin: "left bottom" }}>
            <p className="eyebrow m-0 font-display font-bold text-gray-500 uppercase">{copy.chat.eyebrow}</p>
            <h2
              className="mt-3 mb-0 font-display text-[clamp(22px,3.8vw,60px)] leading-[0.9] font-black tracking-[-0.04em] whitespace-pre text-graphite uppercase"
            >
              {copy.chat.title}
            </h2>
            <p className="mt-5 mb-0 hidden max-w-[30rem] font-display text-[clamp(15px,1.4vw,22px)] leading-[1.35] font-light text-gray-700 md:block">{copy.chat.body}</p>
          </div>

          <div
            data-phone
            className="relative shrink-0 bg-graphite [--pw:min(72vw,31svh,340px)] md:[--pw:min(30vw,41svh,390px)]"
            style={{
              width: "var(--pw)",
              aspectRatio: "9 / 19.5",
              padding: "calc(var(--pw) * 0.03)",
              borderRadius: "calc(var(--pw) * 0.13)",
            }}
          >
            <div className="relative flex h-full w-full flex-col overflow-hidden bg-white" style={{ borderRadius: "calc(var(--pw) * 0.105)" }}>
              <span aria-hidden="true" className="absolute top-[1.6%] left-1/2 z-10 -translate-x-1/2 rounded-full bg-graphite" style={{ width: "28%", height: "3.2%" }} />
              <div className="flex items-center gap-[3%] bg-gray-100 px-[5%] pt-[11%] pb-[4%]" style={{ fontSize: "calc(var(--pw) * 0.045)" }}>
                <span className="grid size-[2.4em] shrink-0 place-items-center rounded-full bg-teal">
                  <img src="/brand/dynamo-simbolo-grafite.png" alt="" className="w-[58%]" />
                </span>
                <div>
                  <p className="m-0 leading-tight font-bold text-graphite">{copy.chat.assistant.name}</p>
                  <p className="m-0 text-[0.8em] leading-tight text-gray-500">{copy.chat.assistant.status}</p>
                </div>
              </div>
              <ol className="m-0 flex flex-1 list-none flex-col justify-end gap-[0.5em] overflow-hidden p-[5%]" style={{ fontSize: "calc(var(--pw) * 0.047)" }}>
                {shown.map((m, i) => (
                  <li
                    key={i}
                    data-bubble={m.from}
                    className={`bubble-in max-w-[84%] px-[0.8em] py-[0.55em] leading-[1.25] ${m.from === "user" ? "self-end rounded-[0.9em] rounded-br-[0.25em] bg-gray-100 text-graphite" : "self-start rounded-[0.9em] rounded-bl-[0.25em] bg-graphite text-white"}`}
                  >
                    {m.text}
                    <span className={`mt-[0.25em] block text-right text-[0.72em] ${m.from === "user" ? "text-gray-500" : "text-gray-300"}`}>{m.time}</span>
                  </li>
                ))}
                {typing === "bot" && (
                  <li data-typing aria-hidden="true" className="bubble-in flex w-fit gap-[0.3em] self-start rounded-[0.9em] rounded-bl-[0.25em] bg-graphite px-[0.9em] py-[0.7em]">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="typing-dot inline-block size-[0.45em] rounded-full bg-gray-300" style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </li>
                )}
              </ol>
              <div aria-hidden="true" className="m-[4%] mt-0 rounded-full bg-gray-100 px-[1em] py-[0.7em] text-gray-500" style={{ fontSize: "calc(var(--pw) * 0.042)" }}>
                Mensagem
              </div>
            </div>
          </div>
        </div>
      </div>
    </StageShell>
  );
}
