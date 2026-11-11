"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CtaButton, GhostButton } from "@/components/ui";
import {
  addSheetAction,
  importStyleAction,
  manualReplyAction,
  readAuthorsAction,
  requestStyleGuideAction,
  saveAutomationsAction,
  saveStyleGuideAction,
  simulateAction,
  type ActionState,
} from "./actions";

export const field =
  "mt-2 w-full rounded-[8px] border border-graphite bg-panel px-4 py-3 text-base text-white outline-none transition focus:border-teal";

/**
 * Envio sem o reset automático do React 19: em erro, o que a pessoa digitou continua no formulário.
 * Com `resetOnSuccess`, limpa só quando deu certo.
 */
function useKeepValues(dispatch: (fd: FormData) => void, state: ActionState, resetOnSuccess = false) {
  const ref = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => dispatch(fd));
  };
  return { ref, onSubmit };
}

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  return state.ok ? (
    state.message ? <p className="text-sm text-teal">{state.message}</p> : null
  ) : (
    <p className="text-sm font-medium text-amber">{state.error}</p>
  );
}

export function ManualReplyForm({ conversationId, allowed }: { conversationId: string; allowed: boolean }) {
  const [state, action, pending] = useActionState(manualReplyAction, null);
  const form = useKeepValues(action, state, true);
  if (!allowed) {
    return <p className="text-sm text-gray-300">Passaram mais de 24 h desde a última mensagem do cliente. Pela regra da Meta, só dá para responder depois que ele escrever de novo.</p>;
  }
  return (
    <form ref={form.ref} onSubmit={form.onSubmit} className="space-y-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <textarea name="text" rows={3} required className={field} placeholder="Responder como atendente…" />
      <Feedback state={state} />
      <CtaButton type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar"}</CtaButton>
    </form>
  );
}

export function StyleUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [authors, setAuthors] = useState<{ author: string; count: number }[]>([]);
  const [agent, setAgent] = useState("");
  const [msg, setMsg] = useState<ActionState>(null);
  const [pending, start] = useTransition();

  const pick = (f: File | null) => {
    setFile(f);
    setAuthors([]);
    setAgent("");
    setMsg(null);
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    start(async () => {
      const r = await readAuthorsAction(fd);
      if ("error" in r) setMsg({ ok: false, error: r.error });
      else setAuthors(r.authors);
    });
  };
  const submit = () => {
    if (!file || !agent) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("agent", agent);
    start(async () => {
      const r = await importStyleAction(fd);
      setMsg(r);
      if (r?.ok) {
        setFile(null);
        setAuthors([]);
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="footer-line">Conversa exportada do WhatsApp (.txt ou .zip)</span>
        <input type="file" accept=".txt,.zip" className={field} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </label>
      {authors.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="footer-line">Quem é o atendente nesta conversa?</legend>
          {authors.map((a) => (
            <label key={a.author} className="flex items-center gap-3 text-sm text-mist">
              <input type="radio" name="agent" value={a.author} checked={agent === a.author} onChange={() => setAgent(a.author)} className="accent-teal" />
              {a.author} <span className="text-gray-500">({a.count} mensagens)</span>
            </label>
          ))}
        </fieldset>
      )}
      <Feedback state={msg} />
      <CtaButton type="button" disabled={pending || !file || !agent} onClick={submit}>
        {pending ? "Processando…" : "Importar exemplos"}
      </CtaButton>
      <p className="text-xs text-gray-500">Nomes, telefones, e-mails e documentos dos clientes são removidos antes de guardar. O arquivo não fica salvo.</p>
    </div>
  );
}

export function GuideEditor({ value }: { value: string }) {
  const [state, action, pending] = useActionState(saveStyleGuideAction, null);
  const form = useKeepValues(action, state);
  return (
    <form ref={form.ref} onSubmit={form.onSubmit} className="space-y-3">
      <textarea name="styleGuide" rows={12} defaultValue={value} className={`${field} font-mono text-sm`} placeholder="Ex.: Tom leve e próximo. Frases curtas. No máximo um emoji. Trata por você…" />
      <Feedback state={state} />
      <CtaButton type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar guia"}</CtaButton>
    </form>
  );
}

export function GenerateGuideButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(requestStyleGuideAction, null);
  return (
    <form action={action} className="space-y-2">
      <GhostButton type="submit" disabled={pending || disabled}>{pending ? "Pedindo…" : "Gerar guia de novo"}</GhostButton>
      <Feedback state={state} />
    </form>
  );
}

export function AddSheetForm() {
  const [state, action, pending] = useActionState(addSheetAction, null);
  const form = useKeepValues(action, state, true);
  return (
    <form ref={form.ref} onSubmit={form.onSubmit} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
      <label className="block">
        <span className="footer-line">Link da planilha</span>
        <input name="url" required className={field} placeholder="https://docs.google.com/spreadsheets/d/…" />
      </label>
      <label className="block">
        <span className="footer-line">Aba</span>
        <input name="tab" required className={field} placeholder="Cardápio" />
      </label>
      <label className="block">
        <span className="footer-line">Nome para o bot</span>
        <input name="label" className={field} placeholder="Cardápio" />
      </label>
      <CtaButton type="submit" disabled={pending}>{pending ? "Adicionando…" : "Adicionar"}</CtaButton>
      <div className="md:col-span-4"><Feedback state={state} /></div>
    </form>
  );
}

type AutomationValues = {
  actions: { registrar_lead: boolean; passar_humano: boolean; avisar_responsavel: boolean; enviar_n8n: boolean };
  n8nWebhookUrl: string;
  ownerPhone: string;
  nonTextPolicy: string;
  handoffHours: number;
  monthlyCapBrl: string;
  extraRules: string;
};

const ACTION_LABELS: [keyof AutomationValues["actions"], string, string][] = [
  ["registrar_lead", "Registrar lead no CRM", "Quando a pessoa mostra interesse real, o contato entra no funil."],
  ["passar_humano", "Passar para humano", "Reclamação, negociação ou dado que não está nas planilhas: o bot para e avisa a equipe."],
  ["avisar_responsavel", "Avisar o responsável", "Mensagem no WhatsApp do responsável em leads quentes (precisa do telefone abaixo)."],
  ["enviar_n8n", "Enviar para o n8n", "Dispara uma automação própria do cliente (precisa da URL abaixo)."],
];

export function AutomationsForm({ values }: { values: AutomationValues }) {
  const [state, action, pending] = useActionState(saveAutomationsAction, null);
  const form = useKeepValues(action, state);
  return (
    <form ref={form.ref} onSubmit={form.onSubmit} className="space-y-8">
      <fieldset className="space-y-4">
        {ACTION_LABELS.map(([key, label, hint]) => (
          <label key={key} className="flex items-start gap-3">
            <input type="checkbox" name={key} defaultChecked={values.actions[key]} className="mt-1 size-4 accent-teal" />
            <span>
              <span className="text-sm font-semibold text-white">{label}</span>
              <span className="block text-xs text-gray-300">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="footer-line">Telefone do responsável (DDI + DDD + número)</span>
          <input name="ownerPhone" defaultValue={values.ownerPhone} className={field} placeholder="5527999990000" />
        </label>
        <label className="block">
          <span className="footer-line">URL do webhook do n8n</span>
          <input name="n8nWebhookUrl" defaultValue={values.n8nWebhookUrl} className={field} placeholder="https://n8n.dynamo.business/webhook/…" />
        </label>
        <label className="block">
          <span className="footer-line">Áudio, imagem e figurinha</span>
          <select name="nonTextPolicy" defaultValue={values.nonTextPolicy} className={field}>
            <option value="pedir_texto">Pedir para escrever</option>
            <option value="humano">Passar para humano</option>
          </select>
        </label>
        <label className="block">
          <span className="footer-line">Horas em modo humano depois de passar</span>
          <input name="handoffHours" type="number" min={1} max={168} defaultValue={values.handoffHours} className={field} />
        </label>
        <label className="block">
          <span className="footer-line">Teto de gasto da IA por mês (R$)</span>
          <input name="monthlyCapBrl" inputMode="decimal" defaultValue={values.monthlyCapBrl} className={field} />
        </label>
      </div>
      <label className="block">
        <span className="footer-line">Regras extras para o bot</span>
        <textarea name="extraRules" rows={4} defaultValue={values.extraRules} className={field} placeholder="Ex.: Não fazemos entrega aos domingos. Sempre ofereça a sobremesa da casa." />
      </label>
      <Feedback state={state} />
      <CtaButton type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</CtaButton>
    </form>
  );
}

export function SimulatorForm() {
  const [state, action, pending] = useActionState(simulateAction, null);
  const form = useKeepValues(action, state, true);
  return (
    <form ref={form.ref} onSubmit={form.onSubmit} className="flex flex-col gap-3 md:flex-row md:items-start">
      <input name="text" required autoComplete="off" className={`${field} !mt-0 flex-1`} placeholder="Escreva como se fosse um cliente…" />
      <CtaButton type="submit" disabled={pending}>{pending ? "Pensando…" : "Enviar"}</CtaButton>
      <div className="md:hidden"><Feedback state={state} /></div>
      <div className="hidden md:block md:w-full"><Feedback state={state} /></div>
    </form>
  );
}
