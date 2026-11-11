/** Worker da fila: pega jobs, executa e cuida das novas tentativas. */
import { eq } from "drizzle-orm";
import {
  MSG_JA_RESPONDO,
  WhatsAppAuthError,
  claimJob,
  completeJob,
  failJob,
  recoverStaleJobs,
  getConfig,
  handOff,
  recordOutgoing,
  type BotJob,
} from "@dynamo/chatbot";
import { schema } from "@dynamo/db";
import { conversationSender, PermanentJobError, processJob, type JobDeps } from "./process-job";

export type { JobDeps } from "./process-job";

async function failNow(deps: JobDeps, job: BotJob, error: string) {
  await deps.db.update(schema.botJob).set({ status: "failed", lastError: error.slice(0, 1000), updatedAt: new Date() }).where(eq(schema.botJob.id, job.id));
}

/** Última tentativa de uma resposta falhou: avisa o cliente e passa para humano (melhor esforço). */
async function finalFallback(deps: JobDeps, job: BotJob) {
  if (job.kind !== "responder" || !job.conversationId) return;
  try {
    const sender = await conversationSender(deps, job.organizationId, job.conversationId);
    if (!sender) return;
    const config = await getConfig(deps.db, job.organizationId);
    const { wamid } = await deps.whatsapp.sendText(sender.creds, sender.conv.waId, MSG_JA_RESPONDO);
    await recordOutgoing(deps.db, job.organizationId, job.conversationId, { author: "bot", text: MSG_JA_RESPONDO, wamid });
    await handOff(
      {
        db: deps.db,
        organizationId: job.organizationId,
        conversationId: job.conversationId,
        waId: sender.conv.waId,
        contactName: sender.conv.contactName,
        config,
        testMode: false,
        notify: sender.notify,
        fetch: deps.fetch,
      },
      "o bot não conseguiu responder depois de 3 tentativas",
    );
  } catch (e) {
    console.error("Falha no aviso final ao cliente:", e);
  }
}

export async function runJob(job: BotJob, deps: JobDeps): Promise<void> {
  try {
    await processJob(job, deps);
    await completeJob(deps.db, job.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof WhatsAppAuthError) {
      const sender = job.conversationId ? await conversationSender(deps, job.organizationId, job.conversationId).catch(() => null) : null;
      if (sender) await deps.db.update(schema.whatsappNumber).set({ status: "com_problema" }).where(eq(schema.whatsappNumber.id, sender.number.id));
      return failNow(deps, job, message);
    }
    if (e instanceof PermanentJobError) return failNow(deps, job, message);
    console.error(`Job ${job.kind} ${job.id} falhou (tentativa ${job.attempts}):`, message);
    if ((await failJob(deps.db, job.id, message)) === "failed") await finalFallback(deps, job);
  }
}

/** Recupera jobs abandonados (queda ou deploy no meio do trabalho) e avisa quem ficou sem resposta. */
export async function reapStaleJobs(deps: JobDeps): Promise<{ requeued: number; failed: number }> {
  const r = await recoverStaleJobs(deps.db);
  for (const job of r.failed) await finalFallback(deps, job);
  if (r.requeued || r.failed.length) console.warn(`Jobs abandonados: ${r.requeued} de volta à fila, ${r.failed.length} com aviso final.`);
  return { requeued: r.requeued, failed: r.failed.length };
}

export function startWorker(deps: JobDeps, opts: { concurrency?: number; idleMs?: number } = {}) {
  const concurrency = opts.concurrency ?? 4;
  const idleMs = opts.idleMs ?? 1000;
  let stopping = false;
  const running = new Set<Promise<void>>();

  async function loop() {
    while (!stopping) {
      let job: BotJob | null = null;
      try {
        job = await claimJob(deps.db);
      } catch (e) {
        console.error("Erro ao buscar jobs:", e);
      }
      if (!job) {
        await new Promise((r) => setTimeout(r, idleMs));
        continue;
      }
      await runJob(job, deps);
    }
  }
  const reap = () => void reapStaleJobs(deps).catch((e) => console.error("Erro ao recuperar jobs:", e));
  reap();
  const reaper = setInterval(reap, 60_000);
  for (let i = 0; i < concurrency; i++) {
    const p = loop();
    running.add(p);
    void p.finally(() => running.delete(p));
  }
  return {
    async stop(timeoutMs = 20_000) {
      stopping = true;
      clearInterval(reaper);
      await Promise.race([Promise.all(running), new Promise((r) => setTimeout(r, timeoutMs))]);
    },
  };
}
