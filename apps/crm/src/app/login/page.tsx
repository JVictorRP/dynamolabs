import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AccentRule, DecoText, FooterLine, Wordmark } from "@/components/brand";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.15fr_1fr]">
      {/* Lado da marca: degradê só em preto e cinza (void → graphite) */}
      <section className="relative hidden flex-col justify-between bg-[linear-gradient(180deg,#0a0a0a_0%,#0a0a0a_45%,#353535_100%)] p-14 lg:flex">
        <Wordmark />
        <DecoText
          className="absolute right-0 top-28 w-[520px]"
          lines={["Automação", "sem pausa", "dados em", "tempo real", "IA aplicada"]}
        />
        <div>
          <p className="eyebrow">Área do cliente</p>
          <h1 className="display mt-6 text-[5.5rem] xl:text-[7rem]">
            Seus
            <br />
            <span className="text-amber">resultados</span>
          </h1>
          <p className="display-light mt-3 text-5xl xl:text-6xl">em um só lugar.</p>
          <AccentRule className="mt-10 w-64" />
        </div>
        <FooterLine>Leads, campanhas e conteúdo, atualizados todos os dias</FooterLine>
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center bg-void px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Wordmark />
            <h1 className="display mt-10 text-5xl">
              Seus <span className="text-amber">resultados</span>
            </h1>
            <p className="display-light mt-2 text-3xl">em um só lugar.</p>
          </div>
          <p className="eyebrow eyebrow-muted mt-12 lg:mt-0">Entrar</p>
          <p className="mt-4 text-base text-gray-300">
            Use o e-mail e a senha que a equipe Dynamo <strong className="font-extrabold italic text-mist">enviou para você.</strong>
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
