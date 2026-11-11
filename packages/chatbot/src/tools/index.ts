import type { BotConfig } from "../config";
import { avisarResponsavel } from "./avisar-responsavel";
import { buscarPlanilha } from "./buscar-planilha";
import { enviarN8n } from "./enviar-n8n";
import { passarHumano } from "./passar-humano";
import { registrarLead } from "./registrar-lead";
import type { BotTool } from "./types";

export * from "./types";
export { handOff } from "./passar-humano";

/** Ferramentas oferecidas ao modelo, em ordem fixa (a ordem faz parte do prefixo em cache). */
export function toolsFor(config: BotConfig): BotTool[] {
  const a = config.actions;
  const tools: BotTool[] = [buscarPlanilha];
  if (a.registrar_lead) tools.push(registrarLead);
  if (a.passar_humano) tools.push(passarHumano);
  if (a.avisar_responsavel && config.ownerPhone) tools.push(avisarResponsavel);
  if (a.enviar_n8n && config.n8nWebhookUrl) tools.push(enviarN8n);
  return tools;
}
