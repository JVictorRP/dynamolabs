"use client";

import { useActionState, useState } from "react";
import { CtaButton, GhostButton } from "@/components/ui";
import { useKeepValues } from "@/components/use-keep-values";
import { addMemberAction, novoClienteAction, resetPasswordAction, type ClientesState, type Credentials } from "./actions";

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

function FormError({ state }: { state: ClientesState }) {
  return state && !state.ok ? <p className="text-sm font-medium text-amber">{state.error}</p> : null;
}

/** Credenciais mostradas uma única vez, com mensagem pronta para mandar ao cliente. */
export function CredentialsCard({ c, loginUrl, onClose, title }: { c: Credentials; loginUrl: string; onClose?: () => void; title?: string }) {
  const [copied, setCopied] = useState(false);
  const message = c.senha
    ? `Olá, ${c.nome.split(" ")[0] || ""}! Seu acesso ao painel da Dynamo:\n${loginUrl}\nE-mail: ${c.login}\nSenha: ${c.senha}\nRecomendamos guardar a senha num lugar seguro.`
    : `Olá, ${c.nome.split(" ")[0]}! Você já pode ver a empresa no painel da Dynamo (${loginUrl}) com o seu e-mail e a senha que você já usa.`;
  return (
    <div className="space-y-4 rounded-[12px] border border-teal/60 bg-panel p-6">
      <p className="eyebrow !text-teal">{title ?? (c.senha ? "Acesso criado — a senha aparece só agora" : "Acesso liberado")}</p>
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        {c.empresa && (
          <div>
            <dt className="footer-line">Empresa</dt>
            <dd className="mt-1 text-white">{c.empresa}</dd>
          </div>
        )}
        <div>
          <dt className="footer-line">E-mail</dt>
          <dd className="mt-1 break-all text-white">{c.login}</dd>
        </div>
        <div>
          <dt className="footer-line">Senha</dt>
          <dd className="mt-1 font-mono text-amber">{c.senha ?? "(a que a pessoa já usa)"}</dd>
        </div>
        {c.apiKey && (
          <div>
            <dt className="footer-line">Chave do n8n</dt>
            <dd className="mt-1 break-all font-mono text-mist">{c.apiKey}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-3">
        <CtaButton
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(message);
            setCopied(true);
          }}
        >
          {copied ? "Copiado" : "Copiar mensagem para o cliente"}
        </CtaButton>
        {onClose && <GhostButton type="button" onClick={onClose}>Fechar</GhostButton>}
      </div>
    </div>
  );
}

export function NovoClienteForm({ loginUrl }: { loginUrl: string }) {
  const [state, action, pending] = useActionState(novoClienteAction, null);
  const { formRef, onSubmit } = useKeepValues(action, state, true);
  return (
    <div className="space-y-6">
      {state?.ok && <CredentialsCard c={state.credentials} loginUrl={loginUrl} />}
      <form ref={formRef} onSubmit={onSubmit} className="grid gap-5 md:grid-cols-3">
        <Field label="Empresa" name="empresa" required placeholder="Ex.: Pizzaria Bella" />
        <Field label="Nome do contato" name="nome" required />
        <Field label="E-mail de acesso" name="email" type="email" required autoComplete="off" />
        <label className="flex items-center gap-3 text-sm text-mist md:col-span-2">
          <input type="checkbox" name="demo" className="size-4 accent-teal" />
          Preencher com dados fictícios (conta de demonstração)
        </label>
        <div className="md:text-right">
          <CtaButton type="submit" disabled={pending} className="w-full md:w-auto">{pending ? "Criando…" : "Criar cliente"}</CtaButton>
        </div>
        <div className="md:col-span-3"><FormError state={state} /></div>
      </form>
    </div>
  );
}

export function AddMemberForm({ organizationId, loginUrl }: { organizationId: string; loginUrl: string }) {
  const [state, action, pending] = useActionState(addMemberAction, null);
  const { formRef, onSubmit } = useKeepValues(action, state, true);
  return (
    <div className="space-y-6">
      {state?.ok && <CredentialsCard c={state.credentials} loginUrl={loginUrl} />}
      <form ref={formRef} onSubmit={onSubmit} className="grid gap-5 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <input type="hidden" name="organizationId" value={organizationId} />
        <Field label="Nome" name="nome" required />
        <Field label="E-mail" name="email" type="email" required autoComplete="off" />
        <label className="block">
          <span className="footer-line">Papel</span>
          <select name="papel" defaultValue="member" className={field}>
            <option value="owner">Dono</option>
            <option value="admin">Admin</option>
            <option value="member">Membro</option>
          </select>
        </label>
        <CtaButton type="submit" disabled={pending}>{pending ? "Adicionando…" : "Adicionar pessoa"}</CtaButton>
        <div className="md:col-span-4"><FormError state={state} /></div>
      </form>
    </div>
  );
}

export function ResetPasswordButton(props: { organizationId: string; userId: string; nome: string; email: string; loginUrl: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  const [open, setOpen] = useState(true);
  return (
    <div className="space-y-3">
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`Gerar uma senha nova para ${props.email}? A senha atual deixa de funcionar e as sessões abertas são encerradas.`)) e.preventDefault();
          else setOpen(true);
        }}
      >
        <input type="hidden" name="organizationId" value={props.organizationId} />
        <input type="hidden" name="userId" value={props.userId} />
        <input type="hidden" name="nome" value={props.nome} />
        <input type="hidden" name="email" value={props.email} />
        <button type="submit" disabled={pending} className="footer-line hover:!text-amber">{pending ? "Gerando…" : "Gerar nova senha"}</button>
      </form>
      <FormError state={state} />
      {state?.ok && open && (
        <CredentialsCard c={state.credentials} loginUrl={props.loginUrl} onClose={() => setOpen(false)} title="Senha nova — aparece só agora" />
      )}
    </div>
  );
}
