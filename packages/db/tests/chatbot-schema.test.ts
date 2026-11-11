import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "../src/index";
import { createTestDb, seedOrg } from "../src/testing";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

async function seedConversation(orgId: string, waId = "5527999990000") {
  const [conv] = await db.insert(schema.conversation).values({ organizationId: orgId, channel: "whatsapp", waId }).returning();
  return conv;
}

describe("chatbot schema", () => {
  it("has the portuguese text search config", async () => {
    const rows = await db.execute(sql`select to_tsvector('portuguese', 'gostosos preços')::text as v`);
    const v = (rows as unknown as { rows?: { v: string }[] }).rows?.[0]?.v ?? (rows as unknown as { v: string }[])[0]?.v;
    expect(v).toContain("'gostos'");
    expect(v).toContain("'prec'");
  });

  it("generates searchable vectors for style examples", async () => {
    const orgId = await seedOrg(db, "Estilo");
    await db.insert(schema.styleExample).values({ organizationId: orgId, customerText: "vocês têm bacalhau?", agentText: "Temos sim! O bacalhau sai hoje às 19h 😊" });
    const found = await db
      .select({ id: schema.styleExample.id })
      .from(schema.styleExample)
      .where(sql`${schema.styleExample.search} @@ plainto_tsquery('portuguese', 'BACALHAU')`);
    expect(found).toHaveLength(1);
  });

  it("allows a single pending responder job per conversation", async () => {
    const orgId = await seedOrg(db, "Fila");
    const conv = await seedConversation(orgId);
    const job = { organizationId: orgId, conversationId: conv.id, kind: "responder" as const, payload: {} };
    await db.insert(schema.botJob).values({ ...job, status: "running" });
    await db.insert(schema.botJob).values({ ...job, status: "pending" });
    await expect(db.insert(schema.botJob).values({ ...job, status: "pending" })).rejects.toThrow();
  });

  it("deletes chatbot rows with the organization", async () => {
    const orgId = await seedOrg(db, "Apagar");
    const conv = await seedConversation(orgId);
    await db.insert(schema.message).values({ organizationId: orgId, conversationId: conv.id, direction: "in", author: "cliente", wamid: "wamid.apagar", type: "text", text: "oi" });
    await db.insert(schema.botConfig).values({ organizationId: orgId });
    await db.delete(schema.organization).where(eq(schema.organization.id, orgId));
    expect(await db.select().from(schema.conversation).where(eq(schema.conversation.organizationId, orgId))).toHaveLength(0);
    expect(await db.select().from(schema.message).where(eq(schema.message.organizationId, orgId))).toHaveLength(0);
    expect(await db.select().from(schema.botConfig).where(eq(schema.botConfig.organizationId, orgId))).toHaveLength(0);
  });
});
