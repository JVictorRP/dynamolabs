"use client";

import { useActionState } from "react";
import { field } from "@/app/(painel)/chatbot/forms";
import { CtaButton } from "@/components/ui";
import { useKeepValues } from "@/components/use-keep-values";
import { saveClientAutomationsAction } from "./actions";

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

export function AutomationsForm({ organizationId, values }: { organizationId: string; values: AutomationValues }) {
  const [state, action, pending] = useActionState(saveClientAutomationsAction, null);
  const { formRef, onSubmit } = useKeepValues(action, state);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-8">
      <input type="hidden" name="organizationId" value={organizationId} />
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
      {state && <p className={`text-sm font-medium ${state.ok ? "text-teal" : "text-amber"}`}>{state.ok ? state.message : state.error}</p>}
      <CtaButton type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</CtaButton>
    </form>
  );
}
