/** O que cada tipo de job faz. */
import { and, eq } from "drizzle-orm";
import {
  MSG_JA_RESPONDO,
  MSG_NAO_TEXTO,
  decrypt,
  generateStyleGuide,
  getConfig,
  getConversationRow,
  handOff,
  markAnswered,
  unanswered,
  isHumanMode,
  monthKey,
  monthSpendBrl,
  overCap,
  recordOutgoing,
  releaseToBot,
  respond,
  syncSheet,
  type BotJob,
  type CreateMessage,
  type SheetFetcher,
  type ToolContext,
  type WhatsAppClient,
} from "@dynamo/chatbot";
import { schema, type Db } from "@dynamo/db";

export type JobDeps = {
  db: Db;
  createMessage: CreateMessage;
  whatsapp: WhatsAppClient;
  fetchSheet: SheetFetcher;
  usdBrl: number;
  encKey: string;
  now: () => Date;
  fetch: typeof fetch;
};

export class PermanentJobError extends Error {}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Contexto de envio de uma conversa do WhatsApp (número ativo da empresa + token decifrado). */
export async function conversationSender(deps: JobDeps, organizationId: string, conversationId: string) {
  const conv = await getConversationRow(deps.db, organizationId, conversationId);
  if (!conv || conv.channel !== "whatsapp") return null;
  const [number] = await deps.db
    .select()
    .from(schema.whatsappNumber)
    .where(and(eq(schema.whatsappNumber.organizationId, organizationId), eq(schema.whatsappNumber.status, "ativo")));
  if (!number) return null;
  const creds = { phoneNumberId: number.phoneNumberId, accessToken: decrypt(number.accessTokenEnc, deps.encKey) };
  const notify: ToolContext["notify"] = async (to, text) => {
    await deps.whatsapp.sendText(creds, to, text);
  };
  return { conv, number, creds, notify };
}

async function reply(deps: JobDeps, job: BotJob) {
  const { db } = deps;
  const organizationId = job.organizationId;
  const conversationId = job.conversationId!;
  const now = deps.now();
  const sender = await conversationSender(deps, organizationId, conversationId);
  if (!sender) return;
  const { conv, creds, notify } = sender;
  const config = await getConfig(db, organizationId);
  if (!config.enabled) return;
  if (conv.mode === "humano") {
    if (isHumanMode(conv, now)) return;
    await releaseToBot(db, organizationId, conversationId);
  }

  const pending = await unanswered(db, organizationId, conversationId);
  const last = pending[pending.length - 1];
  if (!last) return;
  const pendingIds = pending.map((m) => m.id);
  const ctx = { db, organizationId, conversationId, waId: conv.waId, contactName: conv.contactName, config, testMode: false, notify, fetch: deps.fetch };

  if (last.type !== "text" || !last.text) {
    if (config.nonTextPolicy === "humano") return handOff(ctx, `mandou ${last.type === "audio" ? "um áudio" : "uma mídia"}`);
    const { wamid } = await deps.whatsapp.sendText(creds, conv.waId, MSG_NAO_TEXTO);
    await recordOutgoing(db, organizationId, conversationId, { author: "bot", text: MSG_NAO_TEXTO, wamid });
    await markAnswered(db, organizationId, conversationId, pendingIds);
    return;
  }

  const spend = await monthSpendBrl(db, organizationId, now, deps.usdBrl);
  const cap = Number(config.monthlyCapBrl);
  if (overCap(spend, cap)) {
    await handOff({ ...ctx, config: { ...config, ownerPhone: null } }, "teto mensal do chatbot atingido");
    const key = monthKey(now);
    if (config.capNotifiedMonth !== key) {
      await db.update(schema.botConfig).set({ capNotifiedMonth: key }).where(eq(schema.botConfig.organizationId, organizationId));
      if (config.ownerPhone) {
        await notify(
          config.ownerPhone,
          `Teto mensal do chatbot atingido (${brl(spend)} de ${brl(cap)}). As novas conversas foram passadas para a equipe até o fim do mês ou até o teto ser aumentado no painel.`,
        ).catch(() => {});
      }
    }
    return;
  }

  const r = await respond({ db, createMessage: deps.createMessage, organizationId, conversationId, testMode: false, notify, fetch: deps.fetch });
  let text = r.text;
  if (!text) {
    text = MSG_JA_RESPONDO;
    await handOff(ctx, "a IA não gerou resposta");
  }
  const { wamid } = await deps.whatsapp.sendText(creds, conv.waId, text);
  if (last.wamid) await deps.whatsapp.markRead(creds, last.wamid).catch(() => {});
  await recordOutgoing(db, organizationId, conversationId, { author: "bot", text, wamid, usage: r.usage, costUsd: r.costUsd, toolCalls: r.toolCalls });
  await markAnswered(db, organizationId, conversationId, r.answeredIds.length ? r.answeredIds : pendingIds);
}

export async function processJob(job: BotJob, deps: JobDeps): Promise<void> {
  switch (job.kind) {
    case "responder":
      if (!job.conversationId) throw new PermanentJobError("job de resposta sem conversa");
      return reply(deps, job);
    case "sync_planilha": {
      const sourceId = String(job.payload.sourceId ?? "");
      if (!sourceId) throw new PermanentJobError("job de planilha sem sourceId");
      await syncSheet(deps.db, job.organizationId, sourceId, deps.fetchSheet);
      return;
    }
    case "gerar_guia": {
      const draft = await generateStyleGuide({ db: deps.db, createMessage: deps.createMessage, organizationId: job.organizationId });
      await deps.db.update(schema.botConfig).set({ styleGuideDraft: draft }).where(eq(schema.botConfig.organizationId, job.organizationId));
      return;
    }
  }
}
