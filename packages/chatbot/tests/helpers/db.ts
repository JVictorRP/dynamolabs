import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import type { IncomingMessage } from "../../src/whatsapp/webhook-payload";

let n = 0;
export function incoming(over: Partial<IncomingMessage> = {}): IncomingMessage {
  n += 1;
  return {
    phoneNumberId: "PN1",
    waId: "5527988887777",
    contactName: "Ana",
    wamid: `wamid.${Date.now()}.${n}`,
    type: "text",
    text: "oi",
    timestamp: new Date(),
    ...over,
  };
}

/** Faz os jobs pendentes ficarem prontos agora (simula a passagem do debounce). */
export async function makeDue(db: Db) {
  await db.update(schema.botJob).set({ runAfter: sql`now() - interval '1 second'` }).where(eq(schema.botJob.status, "pending"));
}

export async function secondsUntil(db: Db, jobId: string): Promise<number> {
  const [r] = await db
    .select({ s: sql<number>`extract(epoch from ${schema.botJob.runAfter} - now())::float` })
    .from(schema.botJob)
    .where(eq(schema.botJob.id, jobId));
  return Number(r.s);
}
