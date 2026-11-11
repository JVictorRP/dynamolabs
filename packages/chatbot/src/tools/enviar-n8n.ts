import { z } from "zod";
import { defineTool } from "./types";

export const enviarN8n = defineTool({
  name: "enviar_n8n",
  description: "Dispara uma automação da empresa (n8n) com os dados da conversa, por exemplo reserva, pedido ou agendamento.",
  properties: {
    evento: { type: "string", description: "Nome curto do evento, por exemplo 'reserva' ou 'pedido'." },
    dados: { type: "string", description: "Dados do evento em texto ou JSON." },
  },
  input: z.object({ evento: z.string().trim().min(1).max(80), dados: z.string().max(4000) }),
  async run({ evento, dados }, ctx) {
    if (ctx.testMode) return `[teste] enviaria ao n8n: ${evento} — ${dados}`;
    const url = ctx.config.n8nWebhookUrl;
    if (!url) return "Automação não configurada.";
    const res = await ctx.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: ctx.organizationId,
        conversationId: ctx.conversationId,
        waId: ctx.waId,
        evento,
        dados,
        ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 400) throw new Error(`O n8n respondeu ${res.status}.`);
    return "Automação disparada.";
  },
});
