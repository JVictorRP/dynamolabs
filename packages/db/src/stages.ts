import { asc, eq } from "drizzle-orm";
import type { Db } from "./index";
import * as schema from "./schema";

/** Garante que a empresa tenha as etapas padrão do funil e devolve as etapas em ordem. */
export async function ensureStages(db: Db, organizationId: string) {
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
