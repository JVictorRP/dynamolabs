"use client";

import { useActionState } from "react";
import { CtaButton, GhostButton } from "@/components/ui";
import { useKeepValues } from "@/components/use-keep-values";
import { excluirTitularAction, ligarWhatsappAction, resetarSenhaAction, statusWhatsappAction, type AdminFormState } from "./actions";

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

function Result({ state }: { state: AdminFormState }) {
  if (!state) return null;
  return <p className={`text-sm font-medium ${state.ok ? "text-teal" : "text-amber"}`}>{state.ok ? state.message : state.error}</p>;
}

const Token = () => <Field label="Chave da Dynamo (ADMIN_TOKEN)" name="token" type="password" required autoComplete="off" />;

export function LigarWhatsappForm() {
  const [state, action, pending] = useActionState(ligarWhatsappAction, null);
  const { formRef, onSubmit } = useKeepValues(action, state, true);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-8 space-y-5">
      <Token />
      <div className="h-px bg-graphite" />
      <Field label="Slug da empresa" name="slug" required placeholder="bacalhau-club" />
      <Field label="ID do número de telefone (phone_number_id)" name="phoneNumberId" required />
      <Field label="ID da conta do WhatsApp Business (waba_id)" name="wabaId" required />
      <Field label="Número de exibição" name="displayPhone" placeholder="+55 27 99999-0000" />
      <Field label="Token permanente do usuário do sistema" name="accessToken" type="password" required autoComplete="off" />
      <Result state={state} />
      <CtaButton type="submit" disabled={pending} className="w-full">{pending ? "Ligando…" : "Ligar número"}</CtaButton>
    </form>
  );
}

export function StatusWhatsappForm() {
  const [state, action, pending] = useActionState(statusWhatsappAction, null);
  const { formRef, onSubmit } = useKeepValues(action, state, false);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-8 space-y-5">
      <Token />
      <Field label="ID do número de telefone (phone_number_id)" name="phoneNumberId" required />
      <div className="flex gap-3">
        <GhostButton type="submit" name="status" value="desligado" disabled={pending}>Desligar número</GhostButton>
        <GhostButton type="submit" name="status" value="ativo" disabled={pending}>Reativar</GhostButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function TitularForm() {
  const [state, action, pending] = useActionState(excluirTitularAction, null);
  const { formRef, onSubmit } = useKeepValues(action, state, true);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-8 space-y-5">
      <Token />
      <Field label="Slug da empresa" name="slug" required />
      <Field label="Telefone do titular (com DDI e DDD)" name="phone" required placeholder="+55 27 99876-5432" />
      <Result state={state} />
      <CtaButton type="submit" disabled={pending} className="w-full">{pending ? "Apagando…" : "Apagar conversas deste telefone"}</CtaButton>
    </form>
  );
}

export function ResetSenhaForm() {
  const [state, action, pending] = useActionState(resetarSenhaAction, null);
  const { formRef, onSubmit } = useKeepValues(action, state, false);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-8 space-y-5">
      <Token />
      <Field label="E-mail da conta" name="email" type="email" required autoComplete="off" />
      <Result state={state} />
      <CtaButton type="submit" disabled={pending} className="w-full">{pending ? "Gerando…" : "Gerar nova senha"}</CtaButton>
    </form>
  );
}
