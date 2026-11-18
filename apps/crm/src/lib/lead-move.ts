import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";

/** Move um lead de etapa (só dentro da própria empresa) e registra o evento no histórico. */
export async function moveLeadIn(db: Db, organizationId: string, leadId: string, stageId: string, actorId: string | null) {
  // Confere que a etapa pertence à mesma empresa antes de mover.
  const [stage] = await db
    .select({ id: schema.pipelineStage.id, name: schema.pipelineStage.name })
    .from(schema.pipelineStage)
    .where(and(eq(schema.pipelineStage.id, stageId), eq(schema.pipelineStage.organizationId, organizationId)));
  if (!stage) throw new Error("Etapa inválida");

  const updated = await db
    .update(schema.lead)
    .set({ stageId })
    .where(and(eq(schema.lead.id, leadId), eq(schema.lead.organizationId, organizationId)))
    .returning({ id: schema.lead.id });
  if (updated.length === 0) throw new Error("Lead não encontrado");

  await db.insert(schema.leadEvent).values({
    organizationId,
    leadId,
    type: "mudou_etapa",
    payload: { stageId, stageName: stage.name },
    actorId,
  });
}
