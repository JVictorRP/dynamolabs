import { z } from "zod";
import { setHumanMode } from "../rules";
import { defineTool, type ToolContext } from "./types";

/** Passa a conversa para humano (também usado direto pelo cérebro em recusas e falhas). */
export async function handOff(ctx: ToolContext, motivo: string): Promise<void> {
  await setHumanMode(ctx.db, ctx.organizationId, ctx.conversationId, ctx.config.handoffHours);
  if (ctx.config.ownerPhone) {
    await ctx.notify(ctx.config.ownerPhone, `Conversa com ${ctx.contactName ?? ctx.waId} passou para humano: ${motivo}`).catch(() => {});
  }
}

export const passarHumano = defineTool({
  name: "passar_humano",
  description:
    "Passa a conversa para um atendente humano: pedido para falar com pessoa, reclamação, negociação, dado que não está nas planilhas, ou qualquer coisa fora do seu alcance. Depois de chamar, avise a pessoa que um atendente vai continuar.",
  properties: { motivo: { type: "string", description: "Por que a conversa precisa de um humano." } },
  input: z.object({ motivo: z.string().trim().min(1).max(500) }),
  async run({ motivo }, ctx) {
    if (ctx.testMode) return `[teste] passaria para humano: ${motivo}`;
    await handOff(ctx, motivo);
    return "Conversa passada para um atendente humano. Avise a pessoa que alguém da equipe vai continuar o atendimento.";
  },
});
