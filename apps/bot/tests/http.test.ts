import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb } from "@dynamo/db/testing";
import { createHandler } from "../src/http";
import { seedBot } from "./fakes";

const SECRET = "app-secret";
let db: Db;
let close: () => Promise<void>;
let server: Server;
let base: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  server = createServer(createHandler({ db, appSecret: SECRET, verifyToken: "verifica" }));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  await close();
});

const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
const post = (body: string, signature: string | null = sign(body)) =>
  fetch(`${base}/webhook`, { method: "POST", body, headers: signature ? { "x-hub-signature-256": signature, "content-type": "application/json" } : {} });

function payload(phoneNumberId: string, wamid: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: phoneNumberId },
      contacts: [{ wa_id: "5527900001111", profile: { name: "Ana" } }],
      messages: [{ from: "5527900001111", id: wamid, timestamp: "1762800000", type: "text", text: { body: "oi" } }],
      ...extra,
    } }] }],
  });
}
const messagesOf = async (org: string) => db.select().from(schema.message).where(eq(schema.message.organizationId, org));
const jobsOf = async (org: string) => db.select().from(schema.botJob).where(eq(schema.botJob.organizationId, org));

describe("webhook verification", () => {
  it("echoes the challenge with the right token", async () => {
    const r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=42`);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("42");
  });
  it("refuses the wrong token", async () => {
    expect((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=42`)).status).toBe(403);
  });
});

describe("webhook messages", () => {
  it("rejects a bad signature", async () => {
    expect((await post(payload("PN-X", "w1"), "sha256=00")).status).toBe(401);
    expect((await post(payload("PN-X", "w1"), null)).status).toBe(401);
  });

  it("stores the message and schedules one reply, ignoring duplicates", async () => {
    const { org, phoneNumberId } = await seedBot(db, "Valida");
    expect((await post(payload(phoneNumberId, "wamid.V1"))).status).toBe(200);
    expect((await post(payload(phoneNumberId, "wamid.V1"))).status).toBe(200);
    expect(await messagesOf(org)).toHaveLength(1);
    expect(await jobsOf(org)).toHaveLength(1);
  });

  it("answers 200 without effects for statuses, unknown or switched-off numbers, and garbage", async () => {
    const off = await seedBot(db, "Desligado", { status: "desligado" });
    const statusOnly = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: off.phoneNumberId }, statuses: [{ id: "x" }] } }] }] });
    expect((await post(statusOnly)).status).toBe(200);
    expect((await post(payload("PN-DESCONHECIDO", "wamid.U1"))).status).toBe(200);
    expect((await post(payload(off.phoneNumberId, "wamid.O1"))).status).toBe(200);
    expect((await post("isto não é json")).status).toBe(200);
    expect(await messagesOf(off.org)).toHaveLength(0);
    expect(await db.select().from(schema.message).where(eq(schema.message.wamid, "wamid.U1"))).toHaveLength(0);
  });

  it("stores but does not schedule when the bot is disabled", async () => {
    const { org, phoneNumberId } = await seedBot(db, "BotOff", { enabled: false });
    expect((await post(payload(phoneNumberId, "wamid.D1"))).status).toBe(200);
    expect(await messagesOf(org)).toHaveLength(1);
    expect(await jobsOf(org)).toHaveLength(0);
  });

  it("refuses bodies over 1 MB", async () => {
    const big = "x".repeat(1024 * 1024 + 10);
    expect((await post(big)).status).toBe(413);
  });

  it("reports health", async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
