import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureStages, schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { moveLeadIn } from "../src/lib/lead-move";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

async function setup(name: string) {
  const org = await seedOrg(db, name);
  const stages = await ensureStages(db, org);
  const [lead] = await db.insert(schema.lead).values({ organizationId: org, name: "Ana", source: "manual", stageId: stages[0].id }).returning();
  return { org, stages, lead };
}
const stageOf = async (id: string) => (await db.select({ s: schema.lead.stageId }).from(schema.lead).where(eq(schema.lead.id, id)))[0].s;

describe("moveLeadIn", () => {
  it("moves the lead to the chosen stage and records the event", async () => {
    const { org, stages, lead } = await setup("Move");
    await moveLeadIn(db, org, lead.id, stages[2].id, null);
    expect(await stageOf(lead.id)).toBe(stages[2].id);
    const events = await db.select().from(schema.leadEvent).where(eq(schema.leadEvent.leadId, lead.id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "mudou_etapa", payload: { stageId: stages[2].id, stageName: stages[2].name } });
  });

  it("refuses a stage that belongs to another company, leaving the lead where it was", async () => {
    const a = await setup("EmpresaA");
    const b = await setup("EmpresaB");
    await expect(moveLeadIn(db, a.org, a.lead.id, b.stages[1].id, null)).rejects.toThrow("Etapa inválida");
    expect(await stageOf(a.lead.id)).toBe(a.stages[0].id);
  });

  it("refuses a lead that belongs to another company", async () => {
    const a = await setup("DonoA");
    const b = await setup("DonoB");
    await expect(moveLeadIn(db, a.org, b.lead.id, a.stages[1].id, null)).rejects.toThrow("Lead não encontrado");
    expect(await stageOf(b.lead.id)).toBe(b.stages[0].id);
  });
});
