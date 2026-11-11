import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, ne } from "drizzle-orm";
import { claimJob, recordIncoming, scheduleReply, WhatsAppAuthError, WhatsAppTemporaryError, MSG_JA_RESPONDO, MSG_NAO_TEXTO, setHumanMode, recordOutgoing } from "@dynamo/chatbot";
import { schema, type Db } from "@dynamo/db";
import { createTestDb } from "@dynamo/db/testing";
import { purgeOldMessages } from "../src/periodic";
import { reapStaleJobs, runJob, type JobDeps } from "../src/worker";
import { ENC_KEY, fakeLlm, fakeWhatsApp, seedBot, textReply } from "./fakes";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

let seq = 0;
async function incomingJob(name: string, opts: { type?: string; text?: string | null; bot?: Parameters<typeof seedBot>[2] } = {}) {
  const bot = await seedBot(db, name, opts.bot);
  seq += 1;
  const { conversationId } = await recordIncoming(db, bot.org, {
    phoneNumberId: bot.phoneNumberId,
    waId: "5527900002222",
    contactName: "Bia",
    wamid: `wamid.in.${seq}`,
    type: opts.type ?? "text",
    text: opts.text === undefined ? "tem bacalhau?" : opts.text,
    timestamp: new Date(),
  });
  await scheduleReply(db, bot.org, conversationId, 0);
  await db.update(schema.botJob).set({ runAfter: new Date(Date.now() - 1000) }).where(eq(schema.botJob.conversationId, conversationId));
  const job = await claimJob(db);
  if (!job || job.conversationId !== conversationId) throw new Error("job não reivindicado");
  return { ...bot, conversationId, job };
}

function deps(over: Partial<JobDeps> = {}): JobDeps & { wa: ReturnType<typeof fakeWhatsApp> } {
  const wa = fakeWhatsApp();
  return {
    db,
    createMessage: fakeLlm(async () => textReply("Temos sim! 😊")).create,
    whatsapp: wa.client,
    fetchSheet: async () => [],
    usdBrl: 5.5,
    encKey: ENC_KEY,
    now: () => new Date(),
    fetch: (async () => new Response("{}")) as unknown as typeof fetch,
    wa,
    ...over,
  };
}
const jobStatus = async (id: string) => (await db.select().from(schema.botJob).where(eq(schema.botJob.id, id)))[0];
const outgoing = async (conversationId: string) =>
  db.select().from(schema.message).where(eq(schema.message.conversationId, conversationId)).then((r) => r.filter((m) => m.direction === "out"));

describe("runJob responder", () => {
  it("sends the reply with the decrypted token, marks as read and stores usage and cost", async () => {
    const { conversationId, job } = await incomingJob("Envia");
    const d = deps();
    await runJob(job, d);
    expect(d.wa.sent).toEqual([{ phoneNumberId: "PN-Envia", token: "TOKEN-Envia", to: "5527900002222", body: "Temos sim! 😊" }]);
    expect(d.wa.read).toHaveLength(1);
    const [out] = await outgoing(conversationId);
    expect(out).toMatchObject({ author: "bot", text: "Temos sim! 😊", inputTokens: 1000, outputTokens: 100 });
    expect(Number(out.costUsd)).toBeGreaterThan(0);
    expect((await jobStatus(job.id)).status).toBe("done");
  });

  it("stays quiet in human mode", async () => {
    const { org, conversationId, job } = await incomingJob("Humano");
    await setHumanMode(db, org, conversationId, 12);
    const d = deps();
    await runJob(job, d);
    expect(d.wa.sent).toEqual([]);
  });

  it("asks for text when the customer sends an image", async () => {
    const { job } = await incomingJob("Imagem", { type: "image", text: null });
    const d = deps();
    await runJob(job, d);
    expect(d.wa.sent.map((s) => s.body)).toEqual([MSG_NAO_TEXTO]);
  });

  it("parks the conversation for humans when the monthly cap is reached, warning the owner once", async () => {
    const { org, conversationId, job } = await incomingJob("Teto");
    await db.update(schema.botConfig).set({ monthlyCapBrl: "1.00" }).where(eq(schema.botConfig.organizationId, org));
    await recordOutgoing(db, org, conversationId, { author: "bot", text: "antiga", costUsd: 1 });
    await db.update(schema.message).set({ createdAt: new Date(Date.now() - 60_000) }).where(eq(schema.message.text, "antiga"));
    const d = deps();
    await runJob(job, d);
    expect(d.wa.sent.map((s) => s.to)).toEqual(["5527999990000"]);
    expect(d.wa.sent[0].body).toMatch(/teto/i);
    const [conv] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(conv.mode).toBe("humano");

    const second = await incomingJob("Teto2");
    await db.update(schema.botConfig).set({ monthlyCapBrl: "0", capNotifiedMonth: null }).where(eq(schema.botConfig.organizationId, second.org));
    const d2 = deps();
    await runJob(second.job, d2);
    const third = await recordIncoming(db, second.org, { phoneNumberId: second.phoneNumberId, waId: "5527900003333", contactName: null, wamid: "wamid.teto3", type: "text", text: "oi", timestamp: new Date() });
    await scheduleReply(db, second.org, third.conversationId, 0);
    await db.update(schema.botJob).set({ runAfter: new Date(Date.now() - 1000) }).where(eq(schema.botJob.conversationId, third.conversationId));
    await runJob((await claimJob(db))!, d2);
    expect(d2.wa.sent.filter((s) => s.to === "5527999990000")).toHaveLength(1);
  });

  it("marks the number as broken and fails the job on an auth error", async () => {
    const { phoneNumberId, job } = await incomingJob("Auth");
    const d = deps({ whatsapp: fakeWhatsApp({ failWith: new WhatsAppAuthError("expirado") }).client });
    await runJob(job, d);
    const [num] = await db.select().from(schema.whatsappNumber).where(eq(schema.whatsappNumber.phoneNumberId, phoneNumberId));
    expect(num.status).toBe("com_problema");
    expect((await jobStatus(job.id)).status).toBe("failed");
  });

  it("retries temporary errors", async () => {
    const { job } = await incomingJob("Temp");
    await runJob(job, deps({ whatsapp: fakeWhatsApp({ failWith: new WhatsAppTemporaryError("503") }).client }));
    const row = await jobStatus(job.id);
    expect(row.status).toBe("pending");
    expect(row.lastError).toContain("503");
  });

  it("after the last attempt, says it will answer soon and hands off", async () => {
    const { conversationId, job } = await incomingJob("Final");
    await db.update(schema.botJob).set({ attempts: 3 }).where(eq(schema.botJob.id, job.id));
    const d = deps({ createMessage: fakeLlm(async () => { throw new Error("IA fora do ar"); }).create });
    await runJob({ ...job, attempts: 3 }, d);
    expect(d.wa.sent.filter((s) => s.to === "5527900002222").map((s) => s.body)).toEqual([MSG_JA_RESPONDO]);
    expect(d.wa.sent.filter((s) => s.to === "5527999990000")).toHaveLength(1);
    const [conv] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(conv.mode).toBe("humano");
    expect((await jobStatus(job.id)).status).toBe("failed");
  });
});

describe("purgeOldMessages", () => {
  it("deletes messages older than each company's retention", async () => {
    const { org, conversationId } = await incomingJob("Retencao");
    await db.update(schema.botConfig).set({ retentionMonths: 1 }).where(eq(schema.botConfig.organizationId, org));
    await recordOutgoing(db, org, conversationId, { author: "bot", text: "velha" });
    await db.update(schema.message).set({ createdAt: new Date(Date.now() - 40 * 86400_000) }).where(eq(schema.message.text, "velha"));
    const deleted = await purgeOldMessages(db, new Date());
    expect(deleted).toBeGreaterThanOrEqual(1);
    const left = await db.select().from(schema.message).where(eq(schema.message.conversationId, conversationId));
    expect(left.map((m) => m.text)).toEqual(["tem bacalhau?"]);
  });
});

describe("burst during a reply (review critical 1)", () => {
  it("answers a message that arrives while the previous reply is being generated", async () => {
    const { org, phoneNumberId, conversationId, job } = await incomingJob("Rajada", { text: "oi" });
    let calls = 0;
    const seen: unknown[] = [];
    const d = deps({
      createMessage: async (params) => {
        calls += 1;
        seen.push(structuredClone(params.messages));
        if (calls === 1) {
          // O cliente manda a segunda mensagem enquanto o bot pensa na primeira.
          await recordIncoming(db, org, { phoneNumberId, waId: "5527900002222", contactName: "Bia", wamid: "wamid.rajada.2", type: "text", text: "quanto custa o bacalhau?", timestamp: new Date() });
          await scheduleReply(db, org, conversationId, 0);
          return textReply("Oi! Tudo bem?");
        }
        return textReply("O bacalhau sai por R$ 89.");
      },
    });
    await runJob(job, d);
    await db.update(schema.botJob).set({ status: "done" }).where(and(eq(schema.botJob.status, "pending"), ne(schema.botJob.conversationId, conversationId)));
    await db.update(schema.botJob).set({ runAfter: new Date(Date.now() - 1000) }).where(eq(schema.botJob.status, "pending"));
    const second = await claimJob(db);
    expect(second?.conversationId).toBe(conversationId);
    await runJob(second!, d);
    expect(d.wa.sent.map((s) => s.body)).toEqual(["Oi! Tudo bem?", "O bacalhau sai por R$ 89."]);
    const last = (seen[1] as { role: string; content: unknown }[]).at(-1)!;
    expect(last.role).toBe("user");
    expect(JSON.stringify(last.content)).toContain("quanto custa o bacalhau?");
    const msgs = await db.select().from(schema.message).where(eq(schema.message.conversationId, conversationId));
    expect(msgs).toHaveLength(4);
  });
});

describe("reapStaleJobs (review critical 2)", () => {
  it("sends the final fallback for a reply that crashed on its last attempt", async () => {
    const { conversationId, job } = await incomingJob("Reaper");
    await db.update(schema.botJob).set({ attempts: 3, updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.botJob.id, job.id));
    const d = deps();
    const r = await reapStaleJobs(d);
    expect(r.failed).toBe(1);
    expect(d.wa.sent.filter((s) => s.to === "5527900002222").map((s) => s.body)).toEqual([MSG_JA_RESPONDO]);
    const [conv] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(conv.mode).toBe("humano");
  });
});
