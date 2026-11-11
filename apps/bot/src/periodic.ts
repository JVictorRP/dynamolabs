/** Tarefas periódicas: sincronizar planilhas e apagar mensagens antigas. */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { enqueue } from "@dynamo/chatbot";
import { schema, type Db } from "@dynamo/db";

const MIN = 60_000;

export async function enqueueSheetSyncs(db: Db): Promise<number> {
  const sources = await db.select({ id: schema.sheetSource.id, organizationId: schema.sheetSource.organizationId }).from(schema.sheetSource);
  const pending = await db
    .select({ sourceId: sql<string>`${schema.botJob.payload}->>'sourceId'` })
    .from(schema.botJob)
    .where(and(eq(schema.botJob.kind, "sync_planilha"), inArray(schema.botJob.status, ["pending", "running"])));
  const busy = new Set(pending.map((p) => p.sourceId));
  let n = 0;
  for (const s of sources) {
    if (busy.has(s.id)) continue;
    await enqueue(db, { organizationId: s.organizationId, kind: "sync_planilha", payload: { sourceId: s.id } });
    n += 1;
  }
  return n;
}

/** Apaga mensagens mais antigas que a retenção de cada empresa (padrão 12 meses). */
export async function purgeOldMessages(db: Db, now: Date): Promise<number> {
  const deleted = await db
    .delete(schema.message)
    .where(
      lt(
        schema.message.createdAt,
        sql`${now.toISOString()}::timestamptz - make_interval(months => coalesce((select c.retention_months from bot_config c where c.organization_id = ${schema.message.organizationId}), 12))`,
      ),
    )
    .returning({ id: schema.message.id });
  // Jobs antigos já concluídos também saem.
  await db.delete(schema.botJob).where(and(inArray(schema.botJob.status, ["done", "failed"]), lt(schema.botJob.updatedAt, new Date(now.getTime() - 30 * 24 * 60 * MIN))));
  return deleted.length;
}

export function startPeriodic(db: Db) {
  const sync = setInterval(() => void enqueueSheetSyncs(db).catch((e) => console.error("Erro ao agendar planilhas:", e)), 5 * MIN);
  const purge = setInterval(() => void purgeOldMessages(db, new Date()).catch((e) => console.error("Erro na limpeza:", e)), 24 * 60 * MIN);
  void enqueueSheetSyncs(db).catch(() => {});
  return { stop: () => (clearInterval(sync), clearInterval(purge)) };
}
