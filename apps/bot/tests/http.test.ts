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
const lines: string[] = [];

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  server = createServer(createHandler({ db, appSecret: SECRET, verifyToken: "verifica", log: (m) => lines.push(m) }));
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

describe("webhook log (lets the operator see why the bot stayed silent)", () => {
  it("says so when the signature is refused, pointing at META_APP_SECRET", async () => {
    lines.length = 0;
    await post(payload("PN-X", "wl1"), "sha256=00");
    expect(lines.join("\n")).toMatch(/assinatura inválida.*META_APP_SECRET/);
  });

  it("says so when the number is not registered, showing only the end of the id and no personal data", async () => {
    lines.length = 0;
    await post(payload("PN-DESCONHECIDO-9876", "wl2"));
    const out = lines.join("\n");
    expect(out).toMatch(/número não cadastrado.*9876/);
    expect(out).not.toContain("PN-DESCONHECIDO");
    expect(out).not.toContain("5527900001111");
    expect(out).not.toContain("oi");
  });

  it("says so when the number is switched off", async () => {
    const off = await seedBot(db, "LogDesligado", { status: "desligado" });
    lines.length = 0;
    await post(payload(off.phoneNumberId, "wl3"));
    expect(lines.join("\n")).toMatch(/número desligado/);
  });

  it("says so when the message is stored but the bot is off, and when a reply is scheduled", async () => {
    const off = await seedBot(db, "LogBotOff", { enabled: false });
    lines.length = 0;
    await post(payload(off.phoneNumberId, "wl4"));
    expect(lines.join("\n")).toMatch(/bot desligado/);
    const on = await seedBot(db, "LogBotOn");
    lines.length = 0;
    await post(payload(on.phoneNumberId, "wl5"));
    expect(lines.join("\n")).toMatch(/resposta agendada/);
  });

  it("stays quiet for status-only notifications", async () => {
    lines.length = 0;
    await post(JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "PN-Y" }, statuses: [{ id: "x" }] } }] }] }));
    expect(lines).toEqual([]);
  });
});

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
