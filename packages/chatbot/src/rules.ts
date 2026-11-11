import { and, eq, gte, lt, sql } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { markAllAnswered } from "./conversations";

const HOUR = 3600_000;
const SP_OFFSET_HOURS = 3; // America/Sao_Paulo = UTC−3 (sem horário de verão desde 2019)

/** Modo humano: sem prazo (equipe assumiu pelo painel) ou até o prazo da passagem automática. */
export function isHumanMode(conv: { mode: string; handoffUntil: Date | null }, now: Date): boolean {
  return conv.mode === "humano" && (conv.handoffUntil === null || conv.handoffUntil.getTime() > now.getTime());
}

/** Regra da Meta: resposta livre só até 24 h depois da última mensagem do cliente. */
export function canReplyManually(conv: { lastCustomerAt: Date | null }, now: Date): boolean {
  return conv.lastCustomerAt !== null && now.getTime() - conv.lastCustomerAt.getTime() <= 24 * HOUR;
}

function spParts(now: Date) {
  const local = new Date(now.getTime() - SP_OFFSET_HOURS * HOUR);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
}

export function monthKey(now: Date): string {
  const { y, m } = spParts(now);
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function monthRange(now: Date): { start: Date; end: Date } {
  const { y, m } = spParts(now);
  return { start: new Date(Date.UTC(y, m, 1, SP_OFFSET_HOURS)), end: new Date(Date.UTC(y, m + 1, 1, SP_OFFSET_HOURS)) };
}

export function dayRange(now: Date): { start: Date; end: Date } {
  const { y, m, d } = spParts(now);
  return { start: new Date(Date.UTC(y, m, d, SP_OFFSET_HOURS)), end: new Date(Date.UTC(y, m, d + 1, SP_OFFSET_HOURS)) };
}

export async function monthSpendBrl(db: Db, organizationId: string, now: Date, usdBrl: number): Promise<number> {
  const { start, end } = monthRange(now);
  const [r] = await db
    .select({ usd: sql<string>`coalesce(sum(${schema.message.costUsd}), 0)` })
    .from(schema.message)
    .where(and(eq(schema.message.organizationId, organizationId), gte(schema.message.createdAt, start), lt(schema.message.createdAt, end)));
  return Number(r.usd) * usdBrl;
}

export const overCap = (spendBrl: number, capBrl: number) => spendBrl >= capBrl;

/** `hours = null`: sem prazo, até alguém devolver ao bot pelo painel. */
export async function setHumanMode(db: Db, organizationId: string, conversationId: string, hours: number | null): Promise<void> {
  await db
    .update(schema.conversation)
    .set({ mode: "humano", handoffUntil: hours === null ? null : new Date(Date.now() + hours * HOUR), updatedAt: new Date() })
    .where(and(eq(schema.conversation.id, conversationId), eq(schema.conversation.organizationId, organizationId)));
}

export async function releaseToBot(db: Db, organizationId: string, conversationId: string): Promise<void> {
  // O que chegou durante o atendimento humano fica com a equipe: o bot volta só para mensagens novas.
  await markAllAnswered(db, organizationId, conversationId);
  await db
    .update(schema.conversation)
    .set({ mode: "bot", handoffUntil: null, updatedAt: new Date() })
    .where(and(eq(schema.conversation.id, conversationId), eq(schema.conversation.organizationId, organizationId)));
}
