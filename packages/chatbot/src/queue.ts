import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";

export type BotJob = typeof schema.botJob.$inferSelect;
export type JobKind = BotJob["kind"];

const RETRY_SECONDS = [5, 30, 120];
export const MAX_ATTEMPTS = 3;

/** Agenda (ou empurra) a resposta da conversa: rajadas viram um único job pendente. */
export async function scheduleReply(db: Db, organizationId: string, conversationId: string, debounceSeconds: number): Promise<void> {
  const runAfter = sql`now() + make_interval(secs => ${debounceSeconds})`;
  await db
    .insert(schema.botJob)
    .values({ organizationId, conversationId, kind: "responder", payload: {}, runAfter })
    .onConflictDoUpdate({
      target: schema.botJob.conversationId,
      targetWhere: sql`kind = 'responder' and status = 'pending'`,
      set: { runAfter, updatedAt: new Date() },
    });
}

export async function enqueue(
  db: Db,
  job: { organizationId: string; kind: JobKind; payload: Record<string, unknown>; conversationId?: string; runAfter?: Date },
): Promise<string> {
  const [row] = await db
    .insert(schema.botJob)
    .values({ ...job, runAfter: job.runAfter ?? sql`now()` })
    .returning({ id: schema.botJob.id });
  return row.id;
}

/** Pega o próximo job pronto; nunca dois jobs da mesma conversa ao mesmo tempo. */
export async function claimJob(db: Db): Promise<BotJob | null> {
  const [job] = await db
    .update(schema.botJob)
    .set({ status: "running", attempts: sql`${schema.botJob.attempts} + 1`, updatedAt: new Date() })
    .where(
      eq(
        schema.botJob.id,
        sql`(select j.id from bot_job j
              where j.status = 'pending' and j.run_after <= now()
                and (j.conversation_id is null or not exists (
                  select 1 from bot_job r where r.conversation_id = j.conversation_id and r.status = 'running'))
              order by j.run_after
              limit 1
              for update skip locked)`,
      ),
    )
    .returning();
  return job ?? null;
}

export async function completeJob(db: Db, id: string): Promise<void> {
  await db.update(schema.botJob).set({ status: "done", updatedAt: new Date() }).where(eq(schema.botJob.id, id));
}

export async function failJob(db: Db, id: string, error: string): Promise<"retry" | "failed"> {
  const [job] = await db.select().from(schema.botJob).where(eq(schema.botJob.id, id));
  if (!job) return "failed";
  const lastError = error.slice(0, 1000);
  if (job.attempts >= MAX_ATTEMPTS) {
    await db.update(schema.botJob).set({ status: "failed", lastError, updatedAt: new Date() }).where(eq(schema.botJob.id, id));
    return "failed";
  }
  const wait = RETRY_SECONDS[Math.max(job.attempts - 1, 0)] ?? RETRY_SECONDS[RETRY_SECONDS.length - 1];
  try {
    await db
      .update(schema.botJob)
      .set({ status: "pending", lastError, runAfter: sql`now() + make_interval(secs => ${wait})`, updatedAt: new Date() })
      .where(eq(schema.botJob.id, id));
  } catch {
    // Já existe uma resposta pendente mais nova para a conversa: ela cobre esta.
    await db.update(schema.botJob).set({ status: "done", lastError: `${lastError} (coberto por job mais novo)`, updatedAt: new Date() }).where(eq(schema.botJob.id, id));
  }
  return "retry";
}
