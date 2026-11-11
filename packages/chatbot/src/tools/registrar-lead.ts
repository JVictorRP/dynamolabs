import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureStages, schema } from "@dynamo/db";
import { defineTool } from "./types";

export const registrarLead = defineTool({
  name: "registrar_lead",
  description:
    "Registra (ou atualiza) este contato como lead no CRM quando a pessoa demonstra interesse real (pediu orçamento, reserva, preço para comprar, visita).",
  properties: {
    nome: { type: "string", description: "Nome da pessoa, como ela se apresentou." },
    interesse: { type: "string", description: "Resumo curto do que a pessoa quer." },
  },
  input: z.object({ nome: z.string().trim().min(1).max(120), interesse: z.string().trim().min(1).max(1000) }),
  async run({ nome, interesse }, ctx) {
    if (ctx.testMode) return `[teste] registraria lead: ${nome} — ${interesse}`;
    const [first] = await ensureStages(ctx.db, ctx.organizationId);
    const [row] = await ctx.db
      .insert(schema.lead)
      .values({
        organizationId: ctx.organizationId,
        name: nome,
        phone: ctx.waId,
        source: "whatsapp",
        externalId: ctx.waId,
        notes: interesse,
        stageId: first.id,
      })
      .onConflictDoUpdate({
        target: [schema.lead.organizationId, schema.lead.source, schema.lead.externalId],
        set: { name: nome, notes: interesse, updatedAt: new Date() },
      })
      .returning({ id: schema.lead.id, inserted: sql<boolean>`(xmax = 0)` });
    if (row.inserted) {
      await ctx.db.insert(schema.leadEvent).values({ organizationId: ctx.organizationId, leadId: row.id, type: "criado", payload: { origem: "whatsapp" } });
    }
    await ctx.db
      .update(schema.conversation)
      .set({ leadId: row.id })
      .where(and(eq(schema.conversation.id, ctx.conversationId), eq(schema.conversation.organizationId, ctx.organizationId)));
    return row.inserted ? "Lead registrado no CRM." : "Lead atualizado no CRM.";
  },
});
