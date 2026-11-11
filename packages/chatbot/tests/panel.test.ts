import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { updateConfig } from "../src/config";
import { recordIncoming } from "../src/conversations";
import { encrypt } from "../src/crypto";
import {
  addSheetSource,
  applyStyleGuideDraft,
  getConversation,
  listConversations,
  ManualReplyWindowError,
  overview,
  sendManualReply,
  simulate,
} from "../src/panel";
import type { WhatsAppClient } from "../src/whatsapp/client";
import { fakeLlm, toolUse, text } from "./helpers/fake-llm";
import { incoming } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const KEY = randomBytes(32).toString("base64");
function fakeWa() {
  const sent: { to: string; body: string }[] = [];
  const client: WhatsAppClient = {
    async sendText(_n, to, body) {
      sent.push({ to, body });
      return { wamid: "wamid.manual." + sent.length };
    },
    async markRead() {},
  };
  return { client, sent };
}
async function withNumber(org: string) {
  await db.insert(schema.whatsappNumber).values({ organizationId: org, phoneNumberId: "PN-" + org, wabaId: "W", displayPhone: "+55", accessTokenEnc: encrypt("T", KEY) });
}

describe("panel", () => {
  it("overview counts today's conversations in São Paulo time and this month's leads, for the organization only", async () => {
    const org = await seedOrg(db, "Painel");
    const other = await seedOrg(db, "PainelOutro");
    const now = new Date("2026-11-10T15:00:00Z");
    await recordIncoming(db, org, incoming({ waId: "1", timestamp: new Date("2026-11-10T04:00:00Z") })); // 01h em SP: hoje
    await recordIncoming(db, org, incoming({ waId: "2", timestamp: new Date("2026-11-10T02:00:00Z") })); // 23h de ontem
    await recordIncoming(db, other, incoming({ waId: "3", timestamp: new Date("2026-11-10T12:00:00Z") }));
    await db.update(schema.conversation).set({ updatedAt: new Date("2026-11-10T02:00:00Z") }).where(eq(schema.conversation.waId, "2"));
    await db.update(schema.conversation).set({ updatedAt: new Date("2026-11-10T04:00:00Z") }).where(eq(schema.conversation.waId, "1"));
    const o = await overview(db, org, now, 5.5);
    expect(o).toMatchObject({ enabled: false, numberStatus: null, conversationsToday: 1, leadsThisMonth: 0, spendBrl: 0, capBrl: 300 });
  });

  it("hides conversations of other organizations and of the simulator", async () => {
    const org = await seedOrg(db, "Lista");
    const other = await seedOrg(db, "ListaOutra");
    const { conversationId } = await recordIncoming(db, org, incoming({ waId: "10" }));
    await recordIncoming(db, org, incoming({ waId: "sim:u1" }), "simulador");
    expect((await listConversations(db, org, {})).map((c) => c.id)).toEqual([conversationId]);
    expect(await getConversation(db, other, conversationId)).toBeNull();
    expect((await getConversation(db, org, conversationId))?.messages).toHaveLength(1);
  });

  it("refuses manual replies after 24 h and sends them inside the window", async () => {
    const org = await seedOrg(db, "Manual");
    await withNumber(org);
    const now = new Date();
    const old = await recordIncoming(db, org, incoming({ waId: "20", timestamp: new Date(now.getTime() - 25 * 3600_000) }));
    const wa = fakeWa();
    await expect(sendManualReply(db, org, old.conversationId, "oi", { whatsapp: wa.client, encKey: KEY }, now)).rejects.toBeInstanceOf(ManualReplyWindowError);
    const fresh = await recordIncoming(db, org, incoming({ waId: "21" }));
    await sendManualReply(db, org, fresh.conversationId, "Oi! Aqui é a Carla.", { whatsapp: wa.client, encKey: KEY }, now);
    expect(wa.sent).toEqual([{ to: "21", body: "Oi! Aqui é a Carla." }]);
    const conv = await getConversation(db, org, fresh.conversationId);
    expect(conv?.messages.at(-1)).toMatchObject({ author: "humano", text: "Oi! Aqui é a Carla." });
  });

  it("simulates without creating leads and keeps the simulator out of the conversation list", async () => {
    const org = await seedOrg(db, "Simula");
    await updateConfig(db, org, { actions: { registrar_lead: true, passar_humano: true, avisar_responsavel: false, enviar_n8n: false } });
    const llm = fakeLlm([toolUse({ name: "registrar_lead", input: { nome: "Teste", interesse: "x" } }), text("Anotado!")]);
    const r = await simulate({ db, createMessage: llm.create, fetch }, org, "user-1", "quero reservar");
    expect(r.reply.text).toBe("Anotado!");
    expect(r.reply.toolCalls[0]).toMatchObject({ name: "registrar_lead", ok: true });
    expect(r.transcript.map((m) => m.text)).toEqual(["quero reservar", "Anotado!"]);
    expect(await db.select().from(schema.lead).where(eq(schema.lead.organizationId, org))).toHaveLength(0);
    expect(await listConversations(db, org, {})).toEqual([]);
  });

  it("validates sheet links and queues the first sync", async () => {
    const org = await seedOrg(db, "Planilha");
    await expect(addSheetSource(db, org, { url: "https://example.com/x", tab: "A", label: "Cardápio" })).rejects.toThrow(/link/i);
    const s = await addSheetSource(db, org, { url: "https://docs.google.com/spreadsheets/d/ABC123/edit", tab: "Cardápio", label: "Cardápio" });
    expect(s.spreadsheetId).toBe("ABC123");
    const jobs = await db.select().from(schema.botJob).where(eq(schema.botJob.organizationId, org));
    expect(jobs).toEqual([expect.objectContaining({ kind: "sync_planilha", payload: { sourceId: s.id } })]);
  });

  it("applies the style guide draft", async () => {
    const org = await seedOrg(db, "Rascunho");
    await updateConfig(db, org, { styleGuide: "antigo", styleGuideDraft: "novo" });
    const c = await applyStyleGuideDraft(db, org);
    expect(c).toMatchObject({ styleGuide: "novo", styleGuideDraft: null });
  });
});
