import { COPY } from "@/content/copy";

/**
 * Versão estática (sem scroll animado) das seções: usada com "reduzir movimento" e dentro de <noscript>.
 * Componentes de servidor: nada de hooks. Mostram frames-chave do vídeo e o texto real.
 */
const frameUrl = (id: "v1" | "v2", n: number, tier: "desktop" | "mobile") => `/frames/${id}/${tier}/${String(n).padStart(4, "0")}.webp`;

function Frame({ id, n }: { id: "v1" | "v2"; n: number }) {
  return (
    <picture>
      <source media="(max-width: 768px)" srcSet={frameUrl(id, n, "mobile")} />
      <img src={frameUrl(id, n, "desktop")} alt="" className="absolute inset-0 h-full w-full object-cover" />
    </picture>
  );
}

const SCRIM = "radial-gradient(ellipse at 20% 100%, rgba(10,10,10,0.85), rgba(10,10,10,0) 70%), linear-gradient(180deg, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0) 40%, rgba(10,10,10,0.88) 100%)";
const eyebrow = "m-0 font-display text-[clamp(11px,1.1vw,16px)] font-bold tracking-[0.4em] text-amber uppercase";
const title = "m-0 font-display text-[clamp(36px,8vw,112px)] leading-[0.9] font-black tracking-[-0.04em] whitespace-pre text-white uppercase";

function DarkSection({ id, n, children, label }: { id: "v1" | "v2"; n: number; children: React.ReactNode; label: string }) {
  return (
    <section data-static={label} className="relative flex min-h-svh flex-col justify-end overflow-hidden bg-void px-[5vw] pt-28 pb-16">
      <Frame id={id} n={n} />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: SCRIM }} />
      <div className="relative z-10 flex max-w-4xl flex-col gap-4">{children}</div>
    </section>
  );
}

export function HeroStatic() {
  return (
    <DarkSection id="v1" n={1} label="hero">
      <p className={eyebrow}>{COPY.hero.eyebrow}</p>
      <p className="m-0 font-display text-[clamp(16px,2.4vw,36px)] font-light text-gray-300 italic">{COPY.hero.support}</p>
      <h1 className={title}>{COPY.hero.title}</h1>
    </DarkSection>
  );
}

export function Section2Static() {
  return (
    <DarkSection id="v1" n={60} label="section-2">
      <p className={eyebrow}>{COPY.s2.eyebrow}</p>
      <h2 className={title}>{COPY.s2.title}</h2>
      <p className="m-0 max-w-xl font-display text-[clamp(16px,1.6vw,24px)] font-light text-mist">{COPY.s2.body}</p>
    </DarkSection>
  );
}

export function ChatStatic() {
  return (
    <section data-static="chat" className="bg-white px-[5vw] py-24 text-graphite">
      <p className="m-0 font-display text-[clamp(11px,1.1vw,16px)] font-bold tracking-[0.4em] text-gray-500 uppercase">{COPY.chat.eyebrow}</p>
      <h2 className="mt-3 mb-0 font-display text-[clamp(30px,6vw,80px)] leading-[0.9] font-black tracking-[-0.04em] whitespace-pre uppercase">{COPY.chat.title}</h2>
      <p className="mt-6 mb-0 max-w-xl font-display text-[clamp(16px,1.6vw,24px)] font-light text-gray-700">{COPY.chat.body}</p>
    </section>
  );
}

export function Video2Static() {
  return (
    <DarkSection id="v2" n={121} label="video-2">
      <p className={eyebrow}>{COPY.video2.eyebrow}</p>
      <h2 className={title}>{COPY.video2.title}</h2>
      <p className="m-0 max-w-xl font-display text-[clamp(16px,1.6vw,24px)] font-light text-mist">{COPY.video2.support}</p>
      <a
        data-cta
        href="#contato"
        className="mt-4 w-fit rounded-xl bg-teal px-8 py-4 font-label text-xs font-bold tracking-[0.2em] text-graphite uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        {COPY.video2.cta}
      </a>
    </DarkSection>
  );
}
