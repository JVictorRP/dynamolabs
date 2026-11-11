import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { buildMessages, buildSystem } from "../src/brain/prompt";
import { respond } from "../src/brain/respond";
import { generateStyleGuide } from "../src/brain/style-guide";
import { updateConfig } from "../src/config";
import { recordIncoming, recordOutgoing, history } from "../src/conversations";
import { MSG_JA_RESPONDO } from "../src/env";
import { costUsd } from "../src/pricing";
import { syncSheet } from "../src/sheets/sync";
import { fakeLlm, reply, text, toolUse } from "./helpers/fake-llm";
import { incoming } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

async function setup(name: string, msg = "vocês têm bacalhau?") {
  const org = await seedOrg(db, name);
  await updateConfig(db, org, { styleGuide: "Tom leve, frases curtas, um emoji no máximo.", extraRules: "Trate por você." });
  const { conversationId } = await recordIncoming(db, org, incoming({ text: msg, waId: "5527911112222" }));
  const notified: { to: string; text: string }[] = [];
  const deps = (create: Parameters<typeof respond>[0]["createMessage"], testMode = false) => ({
    db,
    createMessage: create,
    organizationId: org,
    conversationId,
    testMode,
    notify: async (to: string, t: string) => void notified.push({ to, text: t }),
    fetch: (async () => new Response("{}")) as unknown as typeof fetch,
  });
  return { org, conversationId, deps, notified };
}
const convOf = async (id: string) => (await db.select().from(schema.conversation).where(eq(schema.conversation.id, id)))[0];

describe("prompt", () => {
  it("builds a stable two-block system prompt with the cache breakpoint on the company block", () => {
    const cfg = { styleGuide: "Guia", extraRules: "Regra" } as Parameters<typeof buildSystem>[1];
    const a = buildSystem({ name: "Bacalhau Club" }, cfg);
    const b = buildSystem({ name: "Bacalhau Club" }, cfg);
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(a[0].cache_control).toBeUndefined();
    expect(a[1].cache_control).toEqual({ type: "ephemeral" });
    expect(a[1].text).toContain("Bacalhau Club");
    expect(a[1].text).toContain("Guia");
    expect(a[0].text).toMatch(/buscar_planilha/);
    expect(a[0].text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("maps history to user/assistant turns, starting with the customer, examples only in the last user turn", () => {
    const m = (author: "cliente" | "bot" | "humano", t: string) => ({ author, text: t, type: "text" }) as Parameters<typeof buildMessages>[0][number];
    const msgs = buildMessages(
      [m("bot", "olá!"), m("cliente", "oi"), m("bot", "posso ajudar?"), m("cliente", "tem mesa?")],
      [{ customerText: "tem vaga?", agentText: "Tem sim! 😊" }],
    );
    expect(msgs.map((x) => x.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[0].content).toBe("oi");
    const last = msgs[2].content as { type: string; text: string }[];
    expect(last[0].text).toContain("Exemplos de como o atendente responde situações parecidas");
    expect(last[0].text).toContain("Tem sim! 😊");
    expect(last[1].text).toBe("tem mesa?");
  });
});

describe("respond", () => {
  it("answers with text and reports usage and cost", async () => {
    const { deps } = await setup("Simples");
    const llm = fakeLlm([text("Temos sim! 😊", { input_tokens: 2000, output_tokens: 50, cache_read_input_tokens: 800 })]);
    const r = await respond(deps(llm.create));
    expect(r.text).toBe("Temos sim! 😊");
    expect(r.handoff).toBe(false);
    expect(r.usage).toEqual({ input: 2000, cached: 800, cacheWrite: 0, output: 50 });
    expect(r.costUsd).toBeCloseTo(costUsd("claude-haiku-5-5", { input_tokens: 2000, output_tokens: 50, cache_read_input_tokens: 800 }), 12);
    const p = llm.calls[0];
    expect(p.model).toBe("claude-haiku-5-5");
    expect(p.output_config).toEqual({ effort: "low" });
    expect(p).not.toHaveProperty("temperature");
    expect(p).not.toHaveProperty("thinking");
    expect(p).not.toHaveProperty("tool_choice");
    expect(p.messages[p.messages.length - 1].role).toBe("user");
  });

  it("runs a tool and sends back the whole assistant content plus one tool_result message", async () => {
    const { org, deps } = await setup("Ferramenta");
    const [s] = await db.insert(schema.sheetSource).values({ organizationId: org, spreadsheetId: "S", tab: "A", label: "Cardápio" }).returning();
    await syncSheet(db, org, s.id, async () => [["Produto", "Preço"], ["Bacalhau", "R$ 89"]]);
    const first = toolUse({ id: "tu_1", name: "buscar_planilha", input: { consulta: "bacalhau", planilha: null } });
    const llm = fakeLlm([first, text("Temos! Sai por R$ 89.")]);
    const r = await respond(deps(llm.create));
    expect(r.text).toBe("Temos! Sai por R$ 89.");
    const second = llm.calls[1].messages;
    expect(second[second.length - 2]).toEqual({ role: "assistant", content: first.content });
    const results = second[second.length - 1];
    expect(results.role).toBe("user");
    expect(results.content).toEqual([expect.objectContaining({ type: "tool_result", tool_use_id: "tu_1", content: expect.stringContaining("R$ 89") })]);
    expect(r.usage.input).toBe(2000);
    expect(r.toolCalls).toEqual([{ name: "buscar_planilha", input: { consulta: "bacalhau", planilha: null }, ok: true }]);
  });

  it("returns parallel results in a single message and reports bad tools as errors", async () => {
    const { deps } = await setup("Paralelo");
    const llm = fakeLlm([
      toolUse(
        { id: "a", name: "buscar_planilha", input: { consulta: "x", planilha: null } },
        { id: "b", name: "ferramenta_inexistente", input: {} },
        { id: "c", name: "registrar_lead", input: { nome: 42 } },
      ),
      text("ok"),
    ]);
    const r = await respond(deps(llm.create));
    const results = llm.calls[1].messages.at(-1)!.content as { tool_use_id: string; is_error?: boolean }[];
    expect(results.map((x) => x.tool_use_id)).toEqual(["a", "b", "c"]);
    expect(results.map((x) => Boolean(x.is_error))).toEqual([false, true, true]);
    expect(r.text).toBe("ok");
    expect(r.toolCalls.map((t) => t.ok)).toEqual([true, false, false]);
  });

  it("hands off to a human on refusal", async () => {
    const { conversationId, deps } = await setup("Recusa");
    const r = await respond(deps(fakeLlm([reply([], "refusal")]).create));
    expect(r).toMatchObject({ handoff: true, text: MSG_JA_RESPONDO });
    expect((await convOf(conversationId)).mode).toBe("humano");
  });

  it("stops after 6 tool rounds and hands off", async () => {
    const { conversationId, deps } = await setup("Laco");
    const llm = fakeLlm([toolUse({ name: "buscar_planilha", input: { consulta: "x", planilha: null } })]);
    const r = await respond(deps(llm.create));
    expect(llm.calls).toHaveLength(6);
    expect(r).toMatchObject({ handoff: true, text: MSG_JA_RESPONDO });
    expect((await convOf(conversationId)).mode).toBe("humano");
  });

  it("does not change anything in test mode, even on refusal", async () => {
    const { conversationId, deps } = await setup("TesteRecusa");
    const r = await respond(deps(fakeLlm([reply([], "refusal")]).create, true));
    expect(r.handoff).toBe(true);
    expect((await convOf(conversationId)).mode).toBe("bot");
  });

  it("does nothing when the last message is not from the customer", async () => {
    const { org, conversationId, deps } = await setup("JaRespondido");
    await recordOutgoing(db, org, conversationId, { author: "humano", text: "Oi! Já te atendo." });
    const llm = fakeLlm([text("não deveria")]);
    const r = await respond(deps(llm.create));
    expect(r.text).toBeNull();
    expect(llm.calls).toHaveLength(0);
  });

  it("sends the matching style examples with the last customer message", async () => {
    const { org, deps } = await setup("Exemplos");
    await db.insert(schema.styleExample).values({ organizationId: org, customerText: "tem bacalhau hoje?", agentText: "Tem sim, fresquinho! 🐟" });
    const llm = fakeLlm([text("Tem!")]);
    await respond(deps(llm.create));
    expect(JSON.stringify(llm.calls[0].messages.at(-1))).toContain("fresquinho");
  });
});

describe("generateStyleGuide", () => {
  it("uses Sonnet, sends at most 60 examples and records the cost", async () => {
    const org = await seedOrg(db, "Guia");
    await db.insert(schema.styleExample).values(
      Array.from({ length: 70 }, (_, i) => ({ organizationId: org, customerText: `pergunta ${i}`, agentText: `resposta ${i}` })),
    );
    const llm = fakeLlm([text("- Tom leve\n- Frases curtas", { input_tokens: 5000, output_tokens: 300 })]);
    const guide = await generateStyleGuide({ db, createMessage: llm.create, organizationId: org });
    expect(guide).toBe("- Tom leve\n- Frases curtas");
    expect(llm.calls[0].model).toBe("claude-sonnet-5-5");
    expect(llm.calls[0].output_config).toEqual({ effort: "medium" });
    const sent = JSON.stringify(llm.calls[0].messages);
    expect((sent.match(/resposta \d+/g) ?? []).length).toBe(60);
    const [conv] = await db.select().from(schema.conversation).where(eq(schema.conversation.organizationId, org));
    expect(conv).toMatchObject({ channel: "sistema", waId: "guia-de-estilo" });
    const msgs = await history(db, org, conv.id);
    expect(Number(msgs[0].costUsd)).toBeCloseTo(costUsd("claude-sonnet-5-5", { input_tokens: 5000, output_tokens: 300 }), 6);
  });
});
