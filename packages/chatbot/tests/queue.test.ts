import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { recordIncoming } from "../src/conversations";
import { claimJob, completeJob, enqueue, failJob, recoverStaleJobs, scheduleReply } from "../src/queue";
import { incoming, makeDue, secondsUntil } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

async function conv(org: string, waId: string) {
  return (await recordIncoming(db, org, incoming({ waId }))).conversationId;
}
const pending = (conversationId: string) =>
  db.select().from(schema.botJob).where(and(eq(schema.botJob.conversationId, conversationId), eq(schema.botJob.status, "pending")));

async function drain() {
  await makeDue(db);
  for (let j = await claimJob(db); j; j = await claimJob(db)) await completeJob(db, j.id);
}

describe("queue", () => {
  it("debounces bursts into one pending job with the latest run time", async () => {
    await drain();
    const org = await seedOrg(db, "Rajada");
    const c = await conv(org, "551");
    await scheduleReply(db, org, c, 4);
    await scheduleReply(db, org, c, 4);
    await scheduleReply(db, org, c, 10);
    const jobs = await pending(c);
    expect(jobs).toHaveLength(1);
    expect(await secondsUntil(db, jobs[0].id)).toBeGreaterThan(8);
    expect(await claimJob(db)).toBeNull(); // ainda no futuro
  });

  it("never runs two replies of the same conversation at once, and runs the later one afterwards", async () => {
    await drain();
    const org = await seedOrg(db, "Exclusiva");
    const c = await conv(org, "552");
    await scheduleReply(db, org, c, 0);
    await makeDue(db);
    const first = await claimJob(db);
    expect(first?.conversationId).toBe(c);

    await scheduleReply(db, org, c, 0); // mensagem nova chegou durante a resposta
    await makeDue(db);
    expect(await pending(c)).toHaveLength(1);
    expect(await claimJob(db)).toBeNull();

    await completeJob(db, first!.id);
    const second = await claimJob(db);
    expect(second?.conversationId).toBe(c);
    expect(second?.id).not.toBe(first!.id);
  });

  it("claims jobs of different conversations in run order and skips future ones", async () => {
    await drain();
    const org = await seedOrg(db, "Ordem");
    const a = await conv(org, "553");
    const b = await conv(org, "554");
    await enqueue(db, { organizationId: org, kind: "responder", payload: {}, conversationId: b, runAfter: new Date(Date.now() - 2000) });
    await enqueue(db, { organizationId: org, kind: "responder", payload: {}, conversationId: a, runAfter: new Date(Date.now() - 5000) });
    await enqueue(db, { organizationId: org, kind: "sync_planilha", payload: {}, runAfter: new Date(Date.now() + 60_000) });
    expect((await claimJob(db))?.conversationId).toBe(a);
    expect((await claimJob(db))?.conversationId).toBe(b);
    expect(await claimJob(db)).toBeNull();
  });

  it("retries after 5 s and 30 s, then fails on the third attempt", async () => {
    await drain();
    const org = await seedOrg(db, "Retry");
    const id = await enqueue(db, { organizationId: org, kind: "sync_planilha", payload: {} });
    let job = await claimJob(db);
    expect(job?.attempts).toBe(1);
    expect(await failJob(db, id, "erro 1")).toBe("retry");
    expect(await secondsUntil(db, id)).toBeGreaterThan(3);
    expect(await secondsUntil(db, id)).toBeLessThan(6);
    await makeDue(db);
    job = await claimJob(db);
    expect(await failJob(db, id, "erro 2")).toBe("retry");
    expect(await secondsUntil(db, id)).toBeGreaterThan(28);
    await makeDue(db);
    job = await claimJob(db);
    expect(job?.attempts).toBe(3);
    expect(await failJob(db, id, "erro 3")).toBe("failed");
    const [row] = await db.select().from(schema.botJob).where(eq(schema.botJob.id, id));
    expect(row).toMatchObject({ status: "failed", lastError: "erro 3" });
  });

  it("folds a failed reply into the newer pending one instead of breaking the unique rule", async () => {
    await drain();
    const org = await seedOrg(db, "Dobra");
    const c = await conv(org, "555");
    await scheduleReply(db, org, c, 0);
    await makeDue(db);
    const running = await claimJob(db);
    await scheduleReply(db, org, c, 0);
    expect(await failJob(db, running!.id, "timeout")).toBe("retry");
    expect(await pending(c)).toHaveLength(1);
  });
});

describe("stale running jobs (review critical 2)", () => {
  it("does not let a job stuck in running block its conversation, and requeues it", async () => {
    await drain();
    const org = await seedOrg(db, "Travado");
    const c = await conv(org, "556");
    await scheduleReply(db, org, c, 0);
    await makeDue(db);
    const stuck = await claimJob(db);
    await db.update(schema.botJob).set({ updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.botJob.id, stuck!.id));
    await scheduleReply(db, org, c, 0); // nova mensagem depois da queda
    await makeDue(db);
    const next = await claimJob(db);
    expect(next?.conversationId).toBe(c);
    await completeJob(db, next!.id);

    const r = await recoverStaleJobs(db);
    expect(r.requeued).toBe(1);
    const [row] = await db.select().from(schema.botJob).where(eq(schema.botJob.id, stuck!.id));
    expect(row.status).toBe("pending");
  });

  it("fails stale jobs that already used every attempt and returns them for the final fallback", async () => {
    await drain();
    const org = await seedOrg(db, "Esgotado");
    const id = await enqueue(db, { organizationId: org, kind: "sync_planilha", payload: {} });
    await db.update(schema.botJob).set({ status: "running", attempts: 3, updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.botJob.id, id));
    const r = await recoverStaleJobs(db);
    expect(r.failed.map((j) => j.id)).toEqual([id]);
    const [row] = await db.select().from(schema.botJob).where(eq(schema.botJob.id, id));
    expect(row.status).toBe("failed");
  });

  it("leaves recent running jobs alone", async () => {
    await drain();
    const org = await seedOrg(db, "Recente");
    const c = await conv(org, "557");
    await scheduleReply(db, org, c, 0);
    await makeDue(db);
    await claimJob(db);
    expect(await recoverStaleJobs(db)).toEqual({ requeued: 0, failed: [] });
  });
});
