import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AccentRule, FooterLine, Wordmark } from "@/components/brand";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Tela de entrada: a marca no topo e todo o texto (apresentação e formulário) compacto no último terço da página,
 * ancorado embaixo. O resto da tela fica livre. Degradê só em preto e cinza (void → graphite).
 */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,#0a0a0a_0%,#0a0a0a_60%,#2c2c2c_100%)] px-6 py-8 lg:px-14 lg:pb-10 lg:pt-10">
      <Wordmark />

      <div className="grid items-end gap-10 pt-16 lg:min-h-[33dvh] lg:grid-cols-[1.3fr_1fr] lg:gap-16 lg:pt-0">
        <section className="flex flex-col gap-3">
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
