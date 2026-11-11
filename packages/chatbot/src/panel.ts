/** Consultas e ações das telas do CRM (seção Chatbot). Sempre com a empresa já validada pela sessão. */
import { and, countDistinct, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import type { CreateMessage } from "./brain/llm";
import { respond, type Reply } from "./brain/respond";
import { getConfig, updateConfig, type BotConfig } from "./config";
import { ensureConversation, getConversationRow, history, recordIncoming, recordOutgoing, type Conversation, type Message } from "./conversations";
import { decrypt } from "./crypto";
import { enqueue } from "./queue";
import { canReplyManually, dayRange, monthRange, monthSpendBrl, releaseToBot } from "./rules";
import { parseSpreadsheetUrl } from "./sheets/fetcher";
import type { WhatsAppClient } from "./whatsapp/client";

export class ManualReplyWindowError extends Error {
  constructor() {
    super("Passaram mais de 24 h desde a última mensagem do cliente. Pela regra da Meta, só dá para responder depois que ele escrever de novo.");
  }
}

export async function overview(db: Db, organizationId: string, now: Date, usdBrl: number) {
  const config = await getConfig(db, organizationId);
  const [number] = await db.select({ status: schema.whatsappNumber.status }).from(schema.whatsappNumber).where(eq(schema.whatsappNumber.organizationId, organizationId));
  const day = dayRange(now);
  const month = monthRange(now);
  const [today] = await db
    .select({ n: countDistinct(schema.message.conversationId) })
    .from(schema.message)
    .innerJoin(schema.conversation, eq(schema.conversation.id, schema.message.conversationId))
    .where(
      and(
        eq(schema.message.organizationId, organizationId),
        eq(schema.conversation.channel, "whatsapp"),
        eq(schema.message.author, "cliente"),
        gte(schema.message.createdAt, day.start),
        lt(schema.message.createdAt, day.end),
      ),
    );
  const [leads] = await db
    .select({ n: count() })
    .from(schema.lead)
    .where(and(eq(schema.lead.organizationId, organizationId), eq(schema.lead.source, "whatsapp"), gte(schema.lead.createdAt, month.start), lt(schema.lead.createdAt, month.end)));
  return {
    enabled: config.enabled,
    numberStatus: number?.status ?? null,
    conversationsToday: Number(today.n),
    leadsThisMonth: Number(leads.n),
    spendBrl: await monthSpendBrl(db, organizationId, now, usdBrl),
    capBrl: Number(config.monthlyCapBrl),
  };
}

export type ConversationRow = Conversation & { lastText: string | null };

export async function listConversations(db: Db, organizationId: string, opts: { mode?: "bot" | "humano"; limit?: number }): Promise<ConversationRow[]> {
  const where = [eq(schema.conversation.organizationId, organizationId), eq(schema.conversation.channel, "whatsapp")];
  if (opts.mode) where.push(eq(schema.conversation.mode, opts.mode));
  const rows = await db
    .select({
      conv: schema.conversation,
      lastText: sql<string | null>`(select m.text from message m where m.conversation_id = ${schema.conversation.id} order by m.created_at desc limit 1)`,
    })
    .from(schema.conversation)
    .where(and(...where))
    .orderBy(desc(schema.conversation.updatedAt))
    .limit(opts.limit ?? 100);
  return rows.map((r) => ({ ...r.conv, lastText: r.lastText }));
}

export async function getConversation(db: Db, organizationId: string, id: string): Promise<(Conversation & { messages: Message[] }) | null> {
  const conv = await getConversationRow(db, organizationId, id);
  if (!conv || conv.channel !== "whatsapp") return null;
  return { ...conv, messages: await history(db, organizationId, id, 200) };
}

export async function sendManualReply(
  db: Db,
  organizationId: string,
  conversationId: string,
  text: string,
  sender: { whatsapp: WhatsAppClient; encKey: string },
  now: Date,
): Promise<void> {
  const body = text.trim();
  if (!body) throw new Error("Escreva a mensagem.");
  const conv = await getConversationRow(db, organizationId, conversationId);
  if (!conv || conv.channel !== "whatsapp") throw new Error("Conversa não encontrada.");
  if (!canReplyManually(conv, now)) throw new ManualReplyWindowError();
  const [number] = await db
    .select()
    .from(schema.whatsappNumber)
    .where(and(eq(schema.whatsappNumber.organizationId, organizationId), eq(schema.whatsappNumber.status, "ativo")));
  if (!number) throw new Error("A empresa não tem número de WhatsApp ativo.");
  const { wamid } = await sender.whatsapp.sendText({ phoneNumberId: number.phoneNumberId, accessToken: decrypt(number.accessTokenEnc, sender.encKey) }, conv.waId, body);
  await recordOutgoing(db, organizationId, conversationId, { author: "humano", text: body, wamid });
}

export { releaseToBot };

const simWaId = (userId: string) => `sim:${userId}`;

export async function simulate(
  deps: { db: Db; createMessage: CreateMessage; fetch: typeof fetch },
  organizationId: string,
  userId: string,
  text: string,
): Promise<{ reply: Reply; transcript: Message[] }> {
  const { db } = deps;
  const body = text.trim().slice(0, 2000);
  if (!body) throw new Error("Escreva uma mensagem.");
  const { conversationId } = await recordIncoming(
    db,
    organizationId,
    { phoneNumberId: "simulador", waId: simWaId(userId), contactName: "Simulador", wamid: `sim.${crypto.randomUUID()}`, type: "text", text: body, timestamp: new Date() },
    "simulador",
  );
  const reply = await respond({ db, createMessage: deps.createMessage, organizationId, conversationId, testMode: true, notify: async () => {}, fetch: deps.fetch });
  await recordOutgoing(db, organizationId, conversationId, {
    author: "bot",
    text: reply.text ?? "(sem resposta)",
    usage: reply.usage,
    costUsd: reply.costUsd,
    toolCalls: reply.toolCalls,
  });
  return { reply, transcript: await history(db, organizationId, conversationId, 100) };
}

export async function simulationTranscript(db: Db, organizationId: string, userId: string): Promise<Message[]> {
  const conv = await ensureConversation(db, organizationId, "simulador", simWaId(userId), "Simulador");
  return history(db, organizationId, conv.id, 100);
}

export async function resetSimulation(db: Db, organizationId: string, userId: string): Promise<void> {
  // Mantém o custo (é gasto real): apaga só o texto do simulador, trocando de "conversa".
  await db
    .update(schema.conversation)
    .set({ waId: `${simWaId(userId)}:${Date.now()}` })
    .where(and(eq(schema.conversation.organizationId, organizationId), eq(schema.conversation.channel, "simulador"), eq(schema.conversation.waId, simWaId(userId))));
}

/* ───── Planilhas ───── */

export async function listSheetSources(db: Db, organizationId: string) {
  return db
    .select({
      source: schema.sheetSource,
      rows: sql<number>`(select count(*)::int from sheet_row r where r.source_id = ${schema.sheetSource.id})`,
    })
    .from(schema.sheetSource)
    .where(eq(schema.sheetSource.organizationId, organizationId))
    .orderBy(schema.sheetSource.createdAt);
}

export async function addSheetSource(db: Db, organizationId: string, input: { url: string; tab: string; label: string }) {
  const spreadsheetId = parseSpreadsheetUrl(input.url.trim());
  if (!spreadsheetId) throw new Error("Link inválido: cole o link da planilha do Google (docs.google.com/spreadsheets/d/...).");
  const tab = input.tab.trim();
  const label = input.label.trim() || tab;
  if (!tab) throw new Error("Informe o nome da aba.");
  const [source] = await db.insert(schema.sheetSource).values({ organizationId, spreadsheetId, tab, label: label.slice(0, 80) }).returning();
  await enqueue(db, { organizationId, kind: "sync_planilha", payload: { sourceId: source.id } });
  return source;
}

export async function removeSheetSource(db: Db, organizationId: string, sourceId: string) {
  await db.delete(schema.sheetSource).where(and(eq(schema.sheetSource.id, sourceId), eq(schema.sheetSource.organizationId, organizationId)));
}

export async function requestSync(db: Db, organizationId: string, sourceId: string) {
  const [s] = await db.select({ id: schema.sheetSource.id }).from(schema.sheetSource).where(and(eq(schema.sheetSource.id, sourceId), eq(schema.sheetSource.organizationId, organizationId)));
  if (!s) throw new Error("Planilha não encontrada.");
  await enqueue(db, { organizationId, kind: "sync_planilha", payload: { sourceId } });
}

/* ───── Estilo ───── */

export async function listExamples(db: Db, organizationId: string, limit = 50) {
  return db.select().from(schema.styleExample).where(eq(schema.styleExample.organizationId, organizationId)).orderBy(desc(schema.styleExample.createdAt)).limit(limit);
}

export async function countExamples(db: Db, organizationId: string): Promise<number> {
  const [r] = await db.select({ n: count() }).from(schema.styleExample).where(eq(schema.styleExample.organizationId, organizationId));
  return Number(r.n);
}

export async function listStyleUploads(db: Db, organizationId: string) {
  return db.select().from(schema.styleUpload).where(eq(schema.styleUpload.organizationId, organizationId)).orderBy(desc(schema.styleUpload.createdAt));
}

export async function removeExample(db: Db, organizationId: string, exampleId: string) {
  await db.delete(schema.styleExample).where(and(eq(schema.styleExample.id, exampleId), eq(schema.styleExample.organizationId, organizationId)));
}

export async function requestStyleGuide(db: Db, organizationId: string) {
  if ((await countExamples(db, organizationId)) === 0) throw new Error("Suba pelo menos uma conversa exportada antes de gerar o guia.");
  await enqueue(db, { organizationId, kind: "gerar_guia", payload: {} });
}

export async function applyStyleGuideDraft(db: Db, organizationId: string): Promise<BotConfig> {
  const config = await getConfig(db, organizationId);
  if (!config.styleGuideDraft) return config;
  return updateConfig(db, organizationId, { styleGuide: config.styleGuideDraft, styleGuideDraft: null });
}
