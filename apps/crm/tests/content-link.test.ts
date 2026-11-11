import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { handleLinkDecision, serveLinkFile } from "../src/lib/content/link";
import { saveUpload } from "../src/lib/content/files";
import { setAvatar } from "../src/lib/content/media";
import { ensureShare, regenerateShare } from "../src/lib/content/share";
import { createFsStorage, type ContentStorage } from "../src/lib/content/storage";
import { clientIp, createRateLimiter } from "../src/lib/rate-limit";
import { config as proxyConfig } from "../src/proxy";

let db: Db;
let close: () => Promise<void>;
let dir: string;
let storage: ContentStorage;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "dyn-link-"));
  storage = createFsStorage(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const H = 3600_000;
const t0 = new Date("2026-11-10T12:00:00Z");
const JPG = (() => {
  const b = new Uint8Array(40);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  for (let i = 4; i < 40; i++) b[i] = i;
  return b;
})();
const body = (data: Uint8Array) => new Response(data as BodyInit).body;

/** Empresa com link, um post e um arquivo gravado de verdade. */
async function company(name: string, post: Partial<typeof schema.contentPost.$inferInsert> = { status: "em_aprovacao" }) {
  const org = await seedOrg(db, name);
  const { token } = await ensureShare(db, org);
  const [p] = await db.insert(schema.contentPost).values({ organizationId: org, title: name, format: "feed", ...post }).returning();
  const saved = await saveUpload(storage, { organizationId: org, body: body(JPG), contentLength: JPG.length });
  await db.insert(schema.contentMedia).values({ organizationId: org, postId: p.id, kind: "image", position: 0, fileKey: saved.key, mime: saved.mime, bytes: saved.bytes });
  return { org, token, post: p, key: saved.key };
}
const limiter = (max = 1000) => createRateLimiter({ windowMs: 10 * 60_000, max, now: () => t0.getTime() });
const fileDeps = (now = t0, l = limiter()) => ({ db, storage, limiter: l, now: () => now });
const getFile = (deps: ReturnType<typeof fileDeps>, token: string, key: string, over: { ip?: string; range?: string | null } = {}) =>
  serveLinkFile(deps, { token, key, ip: over.ip ?? "1.1.1.1", range: over.range ?? null });
const decideDeps = (now = t0, l = limiter()) => ({ db, limiter: l, now: () => now });
const decision = (deps: ReturnType<typeof decideDeps>, token: string, payload: unknown, ip = "1.1.1.1") => handleLinkDecision(deps, { token, ip, body: payload });
async function snapshot(res: Response) {
  return { status: res.status, headers: [...res.headers].sort(), body: await res.text() };
}

describe("serveLinkFile", () => {
  it("serves the files of visible posts, with Range", async () => {
    const c = await company("Visivel");
    const res = await getFile(fileDeps(), c.token, c.key);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPG);
    const part = await getFile(fileDeps(), c.token, c.key, { range: "bytes=4-9" });
    expect(part.status).toBe(206);
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(JPG.slice(4, 10));
  });

  it("the token of organization A never serves a file of organization B, and answers exactly like an unknown token", async () => {
    const a = await company("EmpresaA");
    const b = await company("EmpresaB");
    const cross = await snapshot(await getFile(fileDeps(), a.token, b.key));
    const unknown = await snapshot(await getFile(fileDeps(), "x".repeat(24), b.key));
    const missing = await snapshot(await getFile(fileDeps(), a.token, "00000000-0000-0000-0000-000000000000.jpg"));
    expect(cross.status).toBe(404);
    expect(cross).toEqual(unknown);
    expect(cross).toEqual(missing);
  });

  it("a revoked token answers the same neutral 404", async () => {
    const c = await company("Revogado");
    await regenerateShare(db, c.org);
    const revoked = await snapshot(await getFile(fileDeps(), c.token, c.key));
    const unknown = await snapshot(await getFile(fileDeps(), "y".repeat(24), c.key));
    expect(revoked.status).toBe(404);
    expect(revoked).toEqual(unknown);
  });

  it("a file of a hidden post (draft, archived, past 72 h) is not served through the link", async () => {
    const draft = await company("Rascunho", { status: "rascunho" });
    const archived = await company("Arquivado", { status: "em_aprovacao", archivedAt: t0 });
    const old = await company("Antigo", { status: "aprovado", approvedAt: t0 });
    expect((await getFile(fileDeps(), draft.token, draft.key)).status).toBe(404);
    expect((await getFile(fileDeps(), archived.token, archived.key)).status).toBe(404);
    expect((await getFile(fileDeps(new Date(t0.getTime() + 71 * H)), old.token, old.key)).status).toBe(200);
    expect((await getFile(fileDeps(new Date(t0.getTime() + 73 * H)), old.token, old.key)).status).toBe(404);
  });

  it("serves the profile photo of the company behind the token, and only that one", async () => {
    const a = await company("FotoA");
    const b = await company("FotoB");
    const avatar = await setAvatar(db, storage, a.org, { body: body(JPG), contentLength: JPG.length });
    expect((await getFile(fileDeps(), a.token, avatar.key)).status).toBe(200);
    expect((await getFile(fileDeps(), b.token, avatar.key)).status).toBe(404);
  });

  it("answers 429 when one IP goes over the limit, and not for another IP", async () => {
    const c = await company("Limite");
    const l = limiter(3);
    for (let i = 0; i < 3; i++) expect((await getFile(fileDeps(t0, l), c.token, c.key)).status).toBe(200);
    expect((await getFile(fileDeps(t0, l), c.token, c.key)).status).toBe(429);
    expect((await getFile(fileDeps(t0, l), c.token, c.key, { ip: "2.2.2.2" })).status).toBe(200);
  });
});

describe("handleLinkDecision", () => {
  it("approves a post the link shows, and returns the result", async () => {
    const c = await company("Aprova");
    const res = await decision(decideDeps(), c.token, { postId: c.post.id, decision: "aprovar" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ resultado: "ok" });
    const again = await decision(decideDeps(), c.token, { postId: c.post.id, decision: "aprovar" });
    expect(await again.json()).toEqual({ resultado: "ja_decidido" });
    const [row] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, c.post.id));
    expect(row.status).toBe("aprovado");
  });

  it("asks for adjustment with a comment, and refuses one without", async () => {
    const c = await company("Pede");
    const empty = await decision(decideDeps(), c.token, { postId: c.post.id, decision: "ajuste", comment: " " });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toMatch(/o que precisa mudar/i);
    const ok = await decision(decideDeps(), c.token, { postId: c.post.id, decision: "ajuste", comment: "Trocar a cor" });
    expect(ok.status).toBe(200);
  });

  it("decisions only work on posts the link shows", async () => {
    const mine = await company("Meu");
    const other = await company("Alheio");
    const draft = await company("RascunhoDec", { status: "rascunho" });
    const foreign = await snapshot(await decision(decideDeps(), mine.token, { postId: other.post.id, decision: "aprovar" }));
    const hidden = await snapshot(await decision(decideDeps(), draft.token, { postId: draft.post.id, decision: "aprovar" }));
    const unknownToken = await snapshot(await decision(decideDeps(), "z".repeat(24), { postId: mine.post.id, decision: "aprovar" }));
    expect(foreign.status).toBe(404);
    expect(foreign).toEqual(hidden);
    expect(foreign).toEqual(unknownToken);
    const [row] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, other.post.id));
    expect(row.status).toBe("em_aprovacao");
  });

  it("rejects malformed bodies with 400", async () => {
    const c = await company("Ruim");
    for (const bad of [null, "texto", 42, {}, { postId: 1, decision: "aprovar" }, { postId: c.post.id, decision: "apagar" }, { postId: c.post.id }, { postId: c.post.id, decision: "ajuste", comment: 7 }]) {
      expect((await decision(decideDeps(), c.token, bad)).status).toBe(400);
    }
  });

  it("the limiter blocks the 21st decision from one IP and not another IP", async () => {
    const c = await company("Spam");
    const l = createRateLimiter({ windowMs: 10 * 60_000, max: 20, now: () => t0.getTime() });
    for (let i = 0; i < 20; i++) expect((await decision(decideDeps(t0, l), c.token, { postId: c.post.id, decision: "aprovar" })).status).toBe(200);
    expect((await decision(decideDeps(t0, l), c.token, { postId: c.post.id, decision: "aprovar" })).status).toBe(429);
    expect((await decision(decideDeps(t0, l), c.token, { postId: c.post.id, decision: "aprovar" }, "9.9.9.9")).status).toBe(200);
  });

  it("calls onEvent once for a real decision", async () => {
    const c = await company("Evento");
    const seen: string[] = [];
    await handleLinkDecision({ ...decideDeps(), onEvent: (e) => void seen.push(e.type) }, { token: c.token, ip: "1.1.1.1", body: { postId: c.post.id, decision: "aprovar" } });
    await handleLinkDecision({ ...decideDeps(), onEvent: (e) => void seen.push(e.type) }, { token: c.token, ip: "1.1.1.1", body: { postId: c.post.id, decision: "aprovar" } });
    expect(seen).toEqual(["aprovado"]);
  });
});

describe("rate limiter and client IP", () => {
  it("resets after the window and prunes old addresses", () => {
    let now = 0;
    const l = createRateLimiter({ windowMs: 1000, max: 2, now: () => now });
    expect([l.hit("a"), l.hit("a"), l.hit("a")]).toEqual([true, true, false]);
    now = 1001;
    expect(l.hit("a")).toBe(true);
  });

  it("refuses new addresses when too many are tracked at once", () => {
    const l = createRateLimiter({ windowMs: 60_000, max: 5, now: () => 0, maxTracked: 3 });
    expect([l.hit("a"), l.hit("b"), l.hit("c"), l.hit("d")]).toEqual([true, true, true, false]);
    expect(l.hit("a")).toBe(true); // quem já estava sendo acompanhado continua
  });

  it("clientIp takes the entry added by the last trusted proxy and ignores forged leading ones", () => {
    const h = (v: string) => new Headers({ "x-forwarded-for": v });
    expect(clientIp(h("203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(h("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(h("1.2.3.4, 6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(h("6.6.6.6, 203.0.113.9, 10.0.0.2"), 2)).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBe("desconhecido");
  });
});

describe("proxy matcher", () => {
  const re = new RegExp(`^${proxyConfig.matcher[0]}$`);
  it("lets /p/... through without login and still protects the panel routes", () => {
    for (const open of ["/p/abc", "/p/abcdefghijklmnopqrstuvwx/arquivo/x.jpg", "/p/abc/decisao", "/login", "/admin", "/api/conteudo/arquivos"]) expect(re.test(open), open).toBe(false);
    for (const guarded of ["/", "/conteudo", "/clientes", "/clientes/123/conteudo", "/leads", "/chatbot/estilo", "/pagamentos", "/p", "/painel", "/proposta"]) expect(re.test(guarded), guarded).toBe(true);
  });
});
