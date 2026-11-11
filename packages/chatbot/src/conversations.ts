import { and, desc, eq, sql } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import type { IncomingMessage } from "./whatsapp/webhook-payload";

export type Conversation = typeof schema.conversation.$inferSelect;
export type Message = typeof schema.message.$inferSelect;
export type WhatsappNumber = typeof schema.whatsappNumber.$inferSelect;
export type Channel = "whatsapp" | "simulador" | "sistema";
export type UsageTotals = { input: number; cached: number; cacheWrite: number; output: number };
export type ToolCallRecord = { name: string; input: unknown; ok: boolean };

export async function findNumber(db: Db, phoneNumberId: string): Promise<{ organizationId: string; number: WhatsappNumber } | null> {
  const [number] = await db.select().from(schema.whatsappNumber).where(eq(schema.whatsappNumber.phoneNumberId, phoneNumberId));
  return number ? { organizationId: number.organizationId, number } : null;
}

export async function ensureConversation(
  db: Db,
  organizationId: string,
  channel: Channel,
  waId: string,
  contactName: string | null = null,
): Promise<Conversation> {
  const [conv] = await db
    .insert(schema.conversation)
    .values({ organizationId, channel, waId, contactName })
    .onConflictDoUpdate({
      target: [schema.conversation.organizationId, schema.conversation.channel, schema.conversation.waId],
      set: { contactName: sql`coalesce(excluded.contact_name, ${schema.conversation.contactName})`, updatedAt: new Date() },
    })
    .returning();
  return conv;
}

export async function recordIncoming(
  db: Db,
  organizationId: string,
  msg: IncomingMessage,
  channel: Channel = "whatsapp",
): Promise<{ conversationId: string; duplicate: boolean }> {
  const conv = await ensureConversation(db, organizationId, channel, msg.waId, msg.contactName);
  const inserted = await db
    .insert(schema.message)
    .values({
      organizationId,
      conversationId: conv.id,
      direction: "in",
      author: "cliente",
      wamid: msg.wamid,
      type: msg.type,
      text: msg.text,
      createdAt: msg.timestamp,
    })
    .onConflictDoNothing({ target: schema.message.wamid })
    .returning({ id: schema.message.id });
  if (inserted.length === 0) return { conversationId: conv.id, duplicate: true };
  await db
    .update(schema.conversation)
    .set({ lastCustomerAt: sql`greatest(coalesce(${schema.conversation.lastCustomerAt}, ${msg.timestamp}), ${msg.timestamp})` })
    .where(eq(schema.conversation.id, conv.id));
  return { conversationId: conv.id, duplicate: false };
}

export async function recordOutgoing(
  db: Db,
  organizationId: string,
  conversationId: string,
  m: { author: "bot" | "humano"; text: string; wamid?: string; usage?: UsageTotals; costUsd?: number; toolCalls?: ToolCallRecord[] },
): Promise<void> {
  await db.insert(schema.message).values({
    organizationId,
    conversationId,
    direction: "out",
    author: m.author,
    wamid: m.wamid || null,
    type: "text",
    text: m.text,
    inputTokens: m.usage?.input ?? 0,
    cachedTokens: m.usage?.cached ?? 0,
    cacheWriteTokens: m.usage?.cacheWrite ?? 0,
    outputTokens: m.usage?.output ?? 0,
    costUsd: (m.costUsd ?? 0).toFixed(6),
    toolCalls: m.toolCalls ?? null,
  });
  await db.update(schema.conversation).set({ updatedAt: new Date() }).where(eq(schema.conversation.id, conversationId));
}

export async function getConversationRow(db: Db, organizationId: string, conversationId: string): Promise<Conversation | null> {
  const [c] = await db
    .select()
    .from(schema.conversation)
    .where(and(eq(schema.conversation.id, conversationId), eq(schema.conversation.organizationId, organizationId)));
  return c ?? null;
}

export async function history(db: Db, organizationId: string, conversationId: string, limit = 20): Promise<Message[]> {
  const rows = await db
    .select()
    .from(schema.message)
    .where(and(eq(schema.message.conversationId, conversationId), eq(schema.message.organizationId, organizationId)))
    .orderBy(desc(schema.message.createdAt), desc(schema.message.id))
    .limit(limit);
  return rows.reverse();
}
