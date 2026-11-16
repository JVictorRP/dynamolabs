import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AccentRule, FooterLine, Wordmark } from "@/components/brand";
import DotField from "@/components/dot-field";
import ThoughtLine from "@/components/thought-line";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Tela de entrada: a marca no topo e todo o texto (apresentação e formulário) compacto no último terço da página,
 * ancorado embaixo. O resto da tela fica livre. Degradê só em preto e cinza (void → graphite).
 */
export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,#0a0a0a_0%,#0a0a0a_60%,#2c2c2c_100%)] px-6 py-8 lg:px-14 lg:pb-10 lg:pt-10">
      {/* Fundo (React Bits, DotField): campo de pontos em cinza que reage ao cursor. Esmaece para transparente de cima para baixo (máscara) e fica atrás de tudo (-z-10 dentro do
          isolate) e não captura o mouse: o componente escuta a janela. Em tons de cinza, como manda o degradê do DS. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(180deg,#000_0%,rgba(0,0,0,0.55)_45%,transparent_100%)] [-webkit-mask-image:linear-gradient(180deg,#000_0%,rgba(0,0,0,0.55)_45%,transparent_100%)]">
        <DotField gradientFrom="#4a4a4a" gradientTo="#b5b5b5" dotRadius={1.4} dotSpacing={16} cursorRadius={260} bulgeStrength={0.6} glowColor="#ffffff" glowRadius={170} glowIntensity={0.7} baseOpacity={0.55} holdToZoom={false} />
      </div>

      <Wordmark />

      <div className="grid items-end gap-10 pt-16 lg:min-h-[33dvh] lg:grid-cols-[1.3fr_1fr] lg:gap-16 lg:pt-0">
        <section className="flex flex-col gap-3">
          {/* Decoração (React Bits, ThoughtLine) logo acima da sobrancelha, como no hero do site: textura, não informação. */}
          <div aria-hidden="true" className="pointer-events-none mb-2 select-none">
            <ThoughtLine label="Preparando seus resultados…" collapsible={false} showTimer={false} fontSize={18} color="rgba(255,255,255,0.7)" glyphColor="#ffb339" />
          </div>
          <p className="eyebrow">Área do cliente</p>
          <h1 className="display text-4xl xl:text-5xl">
            Seus <span className="text-amber">resultados</span>
          </h1>
          <p className="display-light text-xl xl:text-2xl">em um só lugar.</p>
          <AccentRule className="mt-3 w-40" />
          <div className="mt-3">
            <FooterLine>Leads, campanhas e conteúdo, atualizados todos os dias</FooterLine>
          </div>
        </section>

        <section className="w-full max-w-sm lg:justify-self-end">
          <p className="eyebrow eyebrow-muted">Entrar</p>
          <p className="mt-2 text-[0.8125rem] leading-snug text-gray-300">
            Use o e-mail e a senha que a equipe Dynamo <strong className="font-extrabold italic text-mist">enviou para você.</strong>
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
