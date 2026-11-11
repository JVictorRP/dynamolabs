import { z } from "zod";
import { defineTool } from "./types";

export const avisarResponsavel = defineTool({
  name: "avisar_responsavel",
  description: "Manda um aviso no WhatsApp do responsável da empresa, por exemplo quando chega um lead quente.",
  properties: { mensagem: { type: "string", description: "Aviso curto para o responsável." } },
  input: z.object({ mensagem: z.string().trim().min(1).max(1000) }),
  async run({ mensagem }, ctx) {
    if (ctx.testMode) return `[teste] avisaria o responsável: ${mensagem}`;
    if (!ctx.config.ownerPhone) return "Não há telefone do responsável configurado.";
    await ctx.notify(ctx.config.ownerPhone, mensagem);
    return "Responsável avisado.";
  },
});
