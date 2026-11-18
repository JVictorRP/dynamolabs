import "server-only";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { ensureStages as ensureStagesIn } from "@dynamo/db";
import { db, schema } from "../db";
import { moveLeadIn } from "../lead-move";

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
export const ensureStages = (organizationId: string) => ensureStagesIn(db, organizationId);

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

export const moveLead = (organizationId: string, leadId: string, stageId: string, actorId: string) =>
  moveLeadIn(db, organizationId, leadId, stageId, actorId);

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

