import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { getConfig, updateConfig } from "../src/config";
import { recordIncoming } from "../src/conversations";
import { ToolInputError, toolsFor } from "../src/tools";
import { syncSheet } from "../src/sheets/sync";
import { makeCtx } from "./helpers/context";
import { incoming } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const ALL_ON = { registrar_lead: true, passar_humano: true, avisar_responsavel: true, enviar_n8n: true };

async function setup(name: string, patch: Parameters<typeof updateConfig>[2] = {}) {
  const org = await seedOrg(db, name);
  const config = await updateConfig(db, org, patch);
  const { conversationId } = await recordIncoming(db, org, incoming({ waId: "5527988887777" }));
  return { org, config, conversationId };
}
const tool = (config: Awaited<ReturnType<typeof getConfig>>, name: string) => {
  const t = toolsFor(config).find((x) => x.name === name);
  if (!t) throw new Error(`ferramenta ${name} não oferecida`);
  return t;
};

describe("toolsFor", () => {
  it("offers only the sheet search when every action is off", async () => {
    const { config } = await setup("Off", { actions: { registrar_lead: false, passar_humano: false, avisar_responsavel: false, enviar_n8n: false } });
    expect(toolsFor(config).map((t) => t.name)).toEqual(["buscar_planilha"]);
  });
  it("needs the n8n URL and the owner phone for their tools", async () => {
    const { config } = await setup("Needs", { actions: ALL_ON });
    expect(toolsFor(config).map((t) => t.name)).toEqual(["buscar_planilha", "registrar_lead", "passar_humano"]);
    const full = await updateConfig(db, config.organizationId, { n8nWebhookUrl: "https://n8n.x/hook", ownerPhone: "5527999990000" });
    expect(toolsFor(full).map((t) => t.name)).toEqual(["buscar_planilha", "registrar_lead", "passar_humano", "avisar_responsavel", "enviar_n8n"]);
  });
  it("declares strict schemas", async () => {
    const { config } = await setup("Strict", { actions: ALL_ON, n8nWebhookUrl: "https://n8n.x/hook", ownerPhone: "5527999990000" });
    for (const t of toolsFor(config)) {
      expect(t.definition.strict).toBe(true);
      expect(t.definition.input_schema.additionalProperties).toBe(false);
      expect(t.definition.input_schema.required).toEqual(Object.keys(t.definition.input_schema.properties ?? {}));
    }
  });
});

describe("tools", () => {
  it("buscar_planilha returns matching rows as text", async () => {
    const { org, config, conversationId } = await setup("Busca");
    const [s] = await db.insert(schema.sheetSource).values({ organizationId: org, spreadsheetId: "S", tab: "A", label: "Cardápio" }).returning();
    await syncSheet(db, org, s.id, async () => [["Produto", "Preço"], ["Bacalhau", "R$ 89"]]);
    const { ctx } = makeCtx(db, org, conversationId, config);
    const out = await tool(config, "buscar_planilha").run({ consulta: "bacalhau", planilha: null }, ctx);
    expect(out).toContain("Bacalhau");
    expect(out).toContain("R$ 89");
    expect(await tool(config, "buscar_planilha").run({ consulta: "pizza", planilha: null }, ctx)).toMatch(/nada encontrado/i);
  });

  it("registrar_lead creates the lead in the first stage and updates it on a second call", async () => {
    const { org, config, conversationId } = await setup("Lead");
    const { ctx } = makeCtx(db, org, conversationId, config);
    await tool(config, "registrar_lead").run({ nome: "Ana Souza", interesse: "jantar para 4" }, ctx);
    await tool(config, "registrar_lead").run({ nome: "Ana Souza", interesse: "jantar para 6, sábado" }, ctx);
    const leads = await db.select().from(schema.lead).where(eq(schema.lead.organizationId, org));
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: "Ana Souza", source: "whatsapp", externalId: "5527988887777", phone: "5527988887777", notes: "jantar para 6, sábado" });
    const [stage] = await db.select().from(schema.pipelineStage).where(eq(schema.pipelineStage.id, leads[0].stageId!));
    expect(stage.position).toBe(0);
    expect(await db.select().from(schema.leadEvent).where(eq(schema.leadEvent.leadId, leads[0].id))).toHaveLength(1);
    const [conv] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(conv.leadId).toBe(leads[0].id);
  });

  it("passar_humano switches to human mode and warns the owner", async () => {
    const { org, config, conversationId } = await setup("Humano", { ownerPhone: "5527999990000" });
    const { ctx, notified } = makeCtx(db, org, conversationId, config);
    await tool(config, "passar_humano").run({ motivo: "quer negociar preço" }, ctx);
    const [conv] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(conv.mode).toBe("humano");
    expect(notified).toEqual([{ to: "5527999990000", text: "Conversa com Ana passou para humano: quer negociar preço" }]);
  });

  it("enviar_n8n posts the event and raises on HTTP errors", async () => {
    const { org, config, conversationId } = await setup("N8n", { actions: ALL_ON, n8nWebhookUrl: "https://n8n.x/hook" });
    const { ctx, posted } = makeCtx(db, org, conversationId, config);
    await tool(config, "enviar_n8n").run({ evento: "reserva", dados: "4 pessoas, sábado 20h" }, ctx);
    expect(posted[0]).toEqual({
      url: "https://n8n.x/hook",
      body: { organizationId: org, conversationId, waId: "5527988887777", evento: "reserva", dados: "4 pessoas, sábado 20h" },
    });
    const failing = makeCtx(db, org, conversationId, config, {
      fetch: (async () => new Response("erro", { status: 500 })) as unknown as typeof fetch,
    }).ctx;
    await expect(tool(config, "enviar_n8n").run({ evento: "x", dados: "y" }, failing)).rejects.toThrow(/500/);
  });

  it("test mode describes the action without doing it", async () => {
    const { org, config, conversationId } = await setup("Teste", { actions: ALL_ON, n8nWebhookUrl: "https://n8n.x/hook", ownerPhone: "5527999990000" });
    const { ctx, notified, posted } = makeCtx(db, org, conversationId, config, { testMode: true });
    expect(await tool(config, "registrar_lead").run({ nome: "Ana", interesse: "x" }, ctx)).toMatch(/^\[teste\] registraria lead/);
    expect(await tool(config, "passar_humano").run({ motivo: "x" }, ctx)).toMatch(/^\[teste\]/);
    expect(await tool(config, "avisar_responsavel").run({ mensagem: "x" }, ctx)).toMatch(/^\[teste\]/);
    expect(await tool(config, "enviar_n8n").run({ evento: "x", dados: "y" }, ctx)).toMatch(/^\[teste\]/);
    expect(await db.select().from(schema.lead).where(eq(schema.lead.organizationId, org))).toHaveLength(0);
    expect(notified).toEqual([]);
    expect(posted).toEqual([]);
    const [conv] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(conv.mode).toBe("bot");
  });

  it("rejects invalid input", async () => {
    const { org, config, conversationId } = await setup("Invalido");
    const { ctx } = makeCtx(db, org, conversationId, config);
    await expect(tool(config, "registrar_lead").run({ nome: 3 }, ctx)).rejects.toBeInstanceOf(ToolInputError);
  });

  it("never touches another organization's data", async () => {
    const a = await setup("ToolA");
    const b = await setup("ToolB");
    const [s] = await db.insert(schema.sheetSource).values({ organizationId: a.org, spreadsheetId: "S", tab: "A", label: "Segredo" }).returning();
    await syncSheet(db, a.org, s.id, async () => [["Item"], ["receita secreta"]]);
    const { ctx } = makeCtx(db, b.org, b.conversationId, b.config);
    expect(await tool(b.config, "buscar_planilha").run({ consulta: "receita secreta", planilha: null }, ctx)).toMatch(/nada encontrado/i);
    await tool(b.config, "passar_humano").run({ motivo: "x" }, makeCtx(db, b.org, a.conversationId, b.config).ctx);
    const [convA] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, a.conversationId));
    expect(convA.mode).toBe("bot");
  });
});
