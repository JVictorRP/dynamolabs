import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Dynamo · Área do cliente</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-100">
          Seus resultados, <span className="text-dyn-orange">em um só lugar.</span>
        </h1>
        <p className="mt-3 text-sm text-ink-400">
          Entre com o e-mail e a senha que a equipe Dynamo enviou para você.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
