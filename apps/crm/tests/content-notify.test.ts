import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { decide } from "../src/lib/content/decisions";
import { flushDigests } from "../src/lib/content/digest";
import { notifyWebhook } from "../src/lib/content/notify";
import { createResendSender } from "../src/lib/content/resend";
import type { ContentEventInfo } from "../src/lib/content/types";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const MIN = 60_000;
const t0 = new Date("2026-11-10T12:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

type Sent = { to: string[]; subject: string; text: string };
const mailer = (failTimes = 0) => {
  const sent: Sent[] = [];
  let failures = failTimes;
  return {
    sent,
    send: async (to: string[], subject: string, text: string) => {
      if (failures > 0) {
        failures -= 1;
        throw new Error("Resend respondeu 500");
      }
      sent.push({ to, subject, text });
    },
  };
};
const deps = (m: ReturnType<typeof mailer>, now: Date, recipients = ["equipe@dynamo.business"]) => ({ now: () => now, send: m.send, recipients, baseUrl: "https://app.dynamo.business" });

async function event(org: string, decision: "aprovar" | "ajuste", when: Date, over: { title?: string; comment?: string } = {}) {
  const [p] = await db.insert(schema.contentPost).values({ organizationId: org, status: "em_aprovacao", title: over.title ?? "Post" }).returning();
  await decide(db, { now: () => when }, { organizationId: org, postId: p.id, decision, comment: over.comment });
  return p;
}
const unsent = async (org: string) =>
  (await db.select().from(schema.contentNotice).where(eq(schema.contentNotice.organizationId, org))).filter((n) => n.sentAt === null).length;

describe("flushDigests", () => {
  it("three events in 10 minutes become one e-mail per company, not three", async () => {
    const org = await seedOrg(db, "Padaria Tres");
    await event(org, "aprovar", at(0), { title: "Reels da fornada" });
    await event(org, "aprovar", at(3 * MIN), { title: "Post único" });
    await event(org, "ajuste", at(6 * MIN), { title: "Carrossel", comment: "Trocar a foto da capa" });
    const m = mailer();
    expect(await flushDigests(db, deps(m, at(10 * MIN)))).toEqual({ sent: 1 });
    expect(m.sent).toHaveLength(1);
    const [mail] = m.sent;
    expect(mail.to).toEqual(["equipe@dynamo.business"]);
    expect(mail.subject).toBe("Dynamo: Padaria Tres — 2 aprovados, 1 pedido de ajuste");
    expect(mail.text).toContain("Aprovados (2):");
    expect(mail.text).toContain("- Reels da fornada");
    expect(mail.text).toContain("Pedidos de ajuste (1):");
    expect(mail.text).toContain('- Carrossel: "Trocar a foto da capa"');
    expect(mail.text).toContain(`https://app.dynamo.business/clientes/${org}/conteudo`);
    expect(await unsent(org)).toBe(0);
  });

  it("nothing is sent before the oldest notice is 10 minutes old", async () => {
    const org = await seedOrg(db, "Cedo");
    await event(org, "aprovar", at(0));
    const m = mailer();
    expect(await flushDigests(db, deps(m, at(10 * MIN - 1)))).toEqual({ sent: 0 });
    expect(m.sent).toEqual([]);
    expect(await unsent(org)).toBe(1);
    expect(await flushDigests(db, deps(m, at(10 * MIN)))).toEqual({ sent: 1 });
  });

  it("two companies get two separate e-mails", async () => {
    const a = await seedOrg(db, "Empresa Alfa");
    const b = await seedOrg(db, "Empresa Beta");
    await event(a, "aprovar", at(0));
    await event(b, "ajuste", at(MIN), { comment: "Mais claro" });
    const m = mailer();
    await flushDigests(db, deps(m, at(30 * MIN)));
    expect(m.sent.map((s) => s.subject).sort()).toEqual(["Dynamo: Empresa Alfa — 1 aprovado", "Dynamo: Empresa Beta — 1 pedido de ajuste"]);
    expect(m.sent.every((s) => !s.text.includes("Empresa " + (s.subject.includes("Alfa") ? "Beta" : "Alfa")))).toBe(true);
  });

  it("a Resend failure keeps the notices and the next run sends them", async () => {
    const org = await seedOrg(db, "Falha Resend");
    await event(org, "aprovar", at(0));
    const m = mailer(1);
    expect(await flushDigests(db, deps(m, at(20 * MIN)))).toEqual({ sent: 0 });
    expect(await unsent(org)).toBe(1);
    expect(await flushDigests(db, deps(m, at(21 * MIN)))).toEqual({ sent: 1 });
    expect(m.sent).toHaveLength(1);
    expect(await unsent(org)).toBe(0);
  });

  it("a restart between the event and the send loses nothing", async () => {
    const org = await seedOrg(db, "Reinicio");
    await event(org, "ajuste", at(0), { comment: "Música baixa" });
    // "reinício": nenhum estado em memória — uma execução nova só tem o banco
    const fresh = mailer();
    expect(await flushDigests(db, deps(fresh, at(45 * MIN)))).toEqual({ sent: 1 });
    expect(fresh.sent[0].text).toContain("Música baixa");
  });

  it("the same notice is never sent twice", async () => {
    const org = await seedOrg(db, "Uma Vez");
    await event(org, "aprovar", at(0));
    const m = mailer();
    await flushDigests(db, deps(m, at(15 * MIN)));
    await flushDigests(db, deps(m, at(30 * MIN)));
    expect(m.sent).toHaveLength(1);
  });

  it("events that arrive after a send go out in the next e-mail", async () => {
    const org = await seedOrg(db, "Duas Levas");
    await event(org, "aprovar", at(0), { title: "Primeiro" });
    const m = mailer();
    await flushDigests(db, deps(m, at(10 * MIN)));
    await event(org, "aprovar", at(11 * MIN), { title: "Segundo" });
    await flushDigests(db, deps(m, at(15 * MIN)));
    expect(m.sent).toHaveLength(1);
    await flushDigests(db, deps(m, at(21 * MIN)));
    expect(m.sent).toHaveLength(2);
    expect(m.sent[1].text).toContain("Segundo");
    expect(m.sent[1].text).not.toContain("Primeiro");
  });

  it("the e-mail is plain text and keeps comments on one line without HTML tags", async () => {
    const org = await seedOrg(db, "Texto Puro");
    await event(org, "ajuste", at(0), { title: "<b>Título</b>", comment: "Linha 1\nLinha 2 <script>x</script>" });
    const m = mailer();
    await flushDigests(db, deps(m, at(10 * MIN)));
    const body = m.sent[0].text;
    expect(body).toContain('- <b>Título</b>: "Linha 1 Linha 2 <script>x</script>"'); // texto literal: o e-mail não é HTML
    expect(body.split("\n").filter((l) => l.startsWith("- ")).length).toBe(1);
  });

  it("without recipients nothing is sent and nothing is marked sent", async () => {
    const org = await seedOrg(db, "Sem Destino");
    await event(org, "aprovar", at(0));
    const m = mailer();
    expect(await flushDigests(db, deps(m, at(60 * MIN), []))).toEqual({ sent: 0 });
    expect(m.sent).toEqual([]);
    expect(await unsent(org)).toBe(1);
  });

  it("notices of deleted posts disappear without breaking the digest", async () => {
    const org = await seedOrg(db, "Post Apagado");
    const gone = await event(org, "aprovar", at(0), { title: "Apagado" });
    await event(org, "aprovar", at(MIN), { title: "Fica" });
    await db.delete(schema.contentPost).where(eq(schema.contentPost.id, gone.id));
    const m = mailer();
    await flushDigests(db, deps(m, at(30 * MIN)));
    const mine = m.sent.find((s) => s.subject.includes("Post Apagado"));
    expect(mine?.text).toContain("- Fica");
    expect(mine?.text).not.toMatch(/- Apagado/);
    expect(await db.select().from(schema.contentNotice).where(isNull(schema.contentNotice.sentAt))).toEqual([]);
  });
});

describe("notifyWebhook", () => {
  const info: ContentEventInfo = { organizationId: "o1", organizationName: "Padaria", postId: "p1", postTitle: "Reels", type: "ajuste_pedido", text: "Trocar", at: t0 };

  it("posts the event as JSON", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    await notifyWebhook("https://n8n.dynamo.business/webhook/x", info, (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}");
    }) as unknown as typeof fetch);
    expect(calls[0].url).toBe("https://n8n.dynamo.business/webhook/x");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ event: "content.ajuste_pedido", organizationId: "o1", organizationName: "Padaria", postId: "p1", postTitle: "Reels", text: "Trocar", at: t0.toISOString() });
  });

  it("does nothing without a URL or with a non-https one", async () => {
    let called = false;
    const spy = (async () => ((called = true), new Response("{}"))) as unknown as typeof fetch;
    await notifyWebhook(undefined, info, spy);
    await notifyWebhook("", info, spy);
    await notifyWebhook("http://inseguro.local/hook", info, spy);
    expect(called).toBe(false);
  });

  it("never throws, even when the URL fails, answers 500, or hangs (it gives up on time)", async () => {
    await expect(notifyWebhook("https://x.test/h", info, (async () => { throw new Error("rede caiu"); }) as unknown as typeof fetch)).resolves.toBeUndefined();
    await expect(notifyWebhook("https://x.test/h", info, (async () => new Response("erro", { status: 500 })) as unknown as typeof fetch)).resolves.toBeUndefined();
    const hang = ((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new Error("abortado"))))) as unknown as typeof fetch;
    const started = Date.now();
    await expect(notifyWebhook("https://x.test/h", info, hang, 50)).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("a hanging webhook never blocks the client's decision", async () => {
    const org = await seedOrg(db, "Webhook Lento");
    const [p] = await db.insert(schema.contentPost).values({ organizationId: org, status: "em_aprovacao" }).returning();
    const hang = (() => new Promise(() => {})) as unknown as typeof fetch;
    const started = Date.now();
    const result = await decide(db, { now: () => t0, onEvent: (e) => void notifyWebhook("https://x.test/h", e, hang, 10_000) }, { organizationId: org, postId: p.id, decision: "aprovar" });
    expect(result).toBe("ok");
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("createResendSender", () => {
  it("sends a plain-text e-mail through the Resend API", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const send = createResendSender({
      apiKey: "re_test",
      from: "Dynamo <avisos@mail.dynamo.business>",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await send(["a@x.com", "b@x.com"], "Assunto", "Corpo");
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ from: "Dynamo <avisos@mail.dynamo.business>", to: ["a@x.com", "b@x.com"], subject: "Assunto", text: "Corpo" });
  });

  it("throws on an HTTP error so the digest keeps the notices", async () => {
    const send = createResendSender({ apiKey: "k", from: "f", fetch: (async () => new Response(JSON.stringify({ message: "domínio não verificado" }), { status: 403 })) as unknown as typeof fetch });
    await expect(send(["a@x.com"], "s", "t")).rejects.toThrow(/403.*domínio não verificado/);
  });
});
