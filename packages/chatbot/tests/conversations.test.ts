import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { getConfig, updateConfig } from "../src/config";
import { findNumber, history, recordIncoming, recordOutgoing } from "../src/conversations";
import { incoming } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

describe("conversations", () => {
  it("ignores a repeated wamid", async () => {
    const org = await seedOrg(db, "Dup");
    const msg = incoming({ wamid: "wamid.DUP" });
    const a = await recordIncoming(db, org, msg);
    const b = await recordIncoming(db, org, msg);
    expect(a.duplicate).toBe(false);
    expect(b).toEqual({ conversationId: a.conversationId, duplicate: true });
    expect(await db.select().from(schema.message).where(eq(schema.message.conversationId, a.conversationId))).toHaveLength(1);
  });

  it("keeps one conversation per contact, updates the name and the last customer time", async () => {
    const org = await seedOrg(db, "Conv");
    const t1 = new Date(Date.now() - 60_000);
    const t2 = new Date();
    const a = await recordIncoming(db, org, incoming({ waId: "5511", contactName: null, timestamp: t1 }));
    const b = await recordIncoming(db, org, incoming({ waId: "5511", contactName: "Bia", timestamp: t2 }));
    expect(b.conversationId).toBe(a.conversationId);
    const [c] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, a.conversationId));
    expect(c.contactName).toBe("Bia");
    expect(c.lastCustomerAt?.getTime()).toBe(t2.getTime());
  });

  it("returns the last messages in chronological order with usage on outgoing ones", async () => {
    const org = await seedOrg(db, "Hist");
    const { conversationId } = await recordIncoming(db, org, incoming({ text: "1" }));
    await recordOutgoing(db, org, conversationId, {
      author: "bot",
      text: "2",
      wamid: "wamid.out.2",
      usage: { input: 100, cached: 10, cacheWrite: 5, output: 20 },
      costUsd: 0.0001,
      toolCalls: [{ name: "buscar_planilha", input: {}, ok: true }],
    });
    await recordIncoming(db, org, incoming({ text: "3" }));
    const h = await history(db, org, conversationId, 2);
    expect(h.map((m) => m.text)).toEqual(["2", "3"]);
    expect(h[0]).toMatchObject({ author: "bot", inputTokens: 100, cachedTokens: 10, cacheWriteTokens: 5, outputTokens: 20 });
    expect(await history(db, await seedOrg(db, "Outra"), conversationId)).toEqual([]);
  });

  it("finds the organization of a phone number", async () => {
    const org = await seedOrg(db, "Num");
    await db.insert(schema.whatsappNumber).values({ organizationId: org, phoneNumberId: "PN-FIND", wabaId: "W", displayPhone: "+55", accessTokenEnc: "v1.x" });
    expect((await findNumber(db, "PN-FIND"))?.organizationId).toBe(org);
    expect(await findNumber(db, "PN-NONE")).toBeNull();
  });
});

describe("config", () => {
  it("creates the defaults on first read", async () => {
    const org = await seedOrg(db, "Cfg");
    const c = await getConfig(db, org);
    expect(c).toMatchObject({ enabled: false, model: "claude-haiku-5-5", debounceSeconds: 4, handoffHours: 12, retentionMonths: 12, nonTextPolicy: "pedir_texto", monthlyCapBrl: "300.00" });
    expect(c.actions).toEqual({ registrar_lead: true, passar_humano: true, avisar_responsavel: false, enviar_n8n: false });
  });

  it("accepts an empty update", async () => {
    const org = await seedOrg(db, "Vazio");
    expect((await updateConfig(db, org, {})).organizationId).toBe(org);
  });

  it("validates updates", async () => {
    const org = await seedOrg(db, "Cfg2");
    await expect(updateConfig(db, org, { n8nWebhookUrl: "http://n8n.local/hook" })).rejects.toThrow(/https/);
    await expect(updateConfig(db, org, { ownerPhone: "27 9abc" })).rejects.toThrow(/telefone/i);
    await expect(updateConfig(db, org, { monthlyCapBrl: -1 })).rejects.toThrow();
    const c = await updateConfig(db, org, { n8nWebhookUrl: "https://n8n.dynamo.business/webhook/x", ownerPhone: "+55 (27) 99876-5432", monthlyCapBrl: 150 });
    expect(c).toMatchObject({ ownerPhone: "5527998765432", monthlyCapBrl: "150.00" });
  });
});
