"use client";

import { useActionState } from "react";
import { novoClienteAction, type NovoClienteState } from "./actions";
import { CtaButton } from "@/components/ui";

const field =
  "mt-2 w-full rounded-[8px] border border-graphite bg-panel px-4 py-3 text-base text-white outline-none transition focus:border-teal";

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="footer-line">{label}</span>
      <input {...props} className={field} />
    </label>
  );
}

export function NovoClienteForm() {
  const [state, action, pending] = useActionState<NovoClienteState, FormData>(novoClienteAction, null);

  if (state?.ok) {
    return (
      <div className="mt-10 space-y-6">
        <p className="display text-3xl">
          Cliente <span className="text-amber">criado</span>
        </p>
        <dl className="space-y-4 rounded-[12px] border border-graphite bg-panel p-6 text-sm">
          <div>
            <dt className="footer-line">Empresa</dt>
            <dd className="mt-1 text-white">{state.empresa}</dd>
          </div>
          <div>
            <dt className="footer-line">Login</dt>
            <dd className="mt-1 text-white">{state.login}</dd>
          </div>
          <div>
            <dt className="footer-line">Chave do n8n (aparece só agora)</dt>
            <dd className="mt-1 break-all font-mono text-amber">{state.apiKey}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3">
          <a href="/login" className="label rounded-[12px] bg-teal px-6 py-3.5 text-[0.7rem] text-graphite">
            Ir para o login
          </a>
          <a href="/admin" className="label rounded-[12px] border border-graphite px-6 py-3.5 text-[0.7rem] text-mist">
            Cadastrar outro
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="mt-10 space-y-5">
      <Field label="Chave da Dynamo (ADMIN_TOKEN)" name="token" type="password" required autoComplete="off" />
      <div className="h-px bg-graphite" />
      <Field label="Empresa" name="empresa" required placeholder="Ex.: Bacalhau Club" />
      <Field label="Nome do contato" name="nome" required />
      <Field label="E-mail de acesso" name="email" type="email" required autoComplete="off" />
      <Field label="Senha (mín. 10 caracteres)" name="senha" type="text" required minLength={10} autoComplete="off" />
      <label className="flex items-center gap-3 text-sm text-mist">
        <input type="checkbox" name="demo" className="size-4 accent-teal" />
        Preencher com dados fictícios (conta de demonstração)
      </label>
      {state && !state.ok && <p className="text-sm font-medium text-amber">{state.error}</p>}
      <CtaButton type="submit" disabled={pending} className="w-full">
        {pending ? "Cadastrando…" : "Cadastrar cliente"}
      </CtaButton>
    </form>
  );
}
