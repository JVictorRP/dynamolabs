import "server-only";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "../db";

type LeadSource = (typeof schema.leadSource.enumValues)[number];

export type IncomingLead = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source: LeadSource;
  externalId?: string | null;
  campaignName?: string | null;
  adsetName?: string | null;
  adName?: string | null;
  formName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  fields?: Record<string, unknown>;
  createdAt?: Date;
};

/** Garante que a empresa tenha as etapas padrão do funil. */
export async function ensureStages(organizationId: string) {
  const existing = await db
    .select()
    .from(schema.pipelineStage)
    .where(eq(schema.pipelineStage.organizationId, organizationId))
    .orderBy(asc(schema.pipelineStage.position));
  if (existing.length > 0) return existing;

  return db
    .insert(schema.pipelineStage)
    .values(schema.DEFAULT_STAGES.map((s) => ({ ...s, organizationId })))
    .returning();
}

/** Insere leads vindos do n8n. Leads repetidos (mesmo externalId + origem) são ignorados. */
export async function ingestLeads(organizationId: string, leads: IncomingLead[]) {
  const stages = await ensureStages(organizationId);
  const firstStage = stages[0];

  const inserted = await db
    .insert(schema.lead)
    .values(leads.map((l) => ({ ...l, organizationId, stageId: firstStage.id })))
    .onConflictDoNothing({
      target: [schema.lead.organizationId, schema.lead.source, schema.lead.externalId],
    })
    .returning({ id: schema.lead.id });

  if (inserted.length > 0) {
    await db.insert(schema.leadEvent).values(
      inserted.map((l) => ({ organizationId, leadId: l.id, type: "criado", payload: {} })),
    );
  }
  return { received: leads.length, inserted: inserted.length };
}

export async function listLeads(organizationId: string, limit = 200) {
  return db.query.lead.findMany({
    where: eq(schema.lead.organizationId, organizationId),
    orderBy: desc(schema.lead.createdAt),
    limit,
  });
}

export async function moveLead(organizationId: string, leadId: string, stageId: string, actorId: string) {
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

export async function leadSummary(organizationId: string, since: Date) {
  const bySource = await db
    .select({ source: schema.lead.source, total: count() })
    .from(schema.lead)
    .where(and(eq(schema.lead.organizationId, organizationId), gte(schema.lead.createdAt, since)))
    .groupBy(schema.lead.source);

  const byStage = await db
    .select({ stageId: schema.lead.stageId, total: count() })
    .from(schema.lead)
    .where(eq(schema.lead.organizationId, organizationId))
    .groupBy(schema.lead.stageId);

  const total = bySource.reduce((acc, r) => acc + Number(r.total), 0);
  return { total, bySource, byStage };
}

