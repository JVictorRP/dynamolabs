"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { CtaButton } from "@/components/ui";

const field =
  "mt-2 w-full rounded-[8px] border border-graphite bg-panel px-4 py-3 text-base text-white outline-none transition focus:border-teal";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Muitas tentativas. Aguarde um minuto." : "E-mail ou senha incorretos.");
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <label className="block">
        <span className="footer-line">E-mail</span>
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <label className="block">
        <span className="footer-line">Senha</span>
        <input name="password" type="password" required autoComplete="current-password" className={field} />
      </label>
      {error && <p className="text-sm font-medium text-amber">{error}</p>}
      <CtaButton type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando…" : "Entrar"}
      </CtaButton>
    </form>
  );
}
