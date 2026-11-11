import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { decide, listPendingActions, markHandled, countPendingActions } from "../src/lib/content/decisions";
import {
  archivePost,
  createPost,
  deletePost,
  listPostsForClient,
  listPostsForStaff,
  reopenPost,
  setStatus,
  updatePost,
} from "../src/lib/content/posts";
import { ensureShare, getActiveShare, regenerateShare, resolveShare } from "../src/lib/content/share";
import { daysLeft, HIDE_AFTER_MS, isVisibleToClient } from "../src/lib/content/visibility";
import type { ContentEventInfo } from "../src/lib/content/types";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const H = 3600_000;
const t0 = new Date("2026-11-10T12:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

async function mkPost(org: string, over: Partial<typeof schema.contentPost.$inferInsert> = {}) {
  const [p] = await db.insert(schema.contentPost).values({ organizationId: org, title: "Post", ...over }).returning();
  return p;
}
const decideDeps = (now: Date, events: ContentEventInfo[] = []) => ({ now: () => now, onEvent: (e: ContentEventInfo) => void events.push(e) });
const eventsOf = (postId: string) => db.select().from(schema.contentEvent).where(eq(schema.contentEvent.postId, postId));

describe("visibility", () => {
  it("a post is visible at 71h59 and hidden at 72h01 after approval", async () => {
    const org = await seedOrg(db, "Janela");
    const p = await mkPost(org, { status: "aprovado", approvedAt: t0 });
    expect(HIDE_AFTER_MS).toBe(72 * H);
    expect(isVisibleToClient(p, at(72 * H - 60_000))).toBe(true);
    expect(isVisibleToClient(p, at(72 * H + 60_000))).toBe(false);
    expect((await listPostsForClient(db, org, at(72 * H - 60_000))).map((x) => x.id)).toEqual([p.id]);
    expect(await listPostsForClient(db, org, at(72 * H + 60_000))).toEqual([]);
    expect(isVisibleToClient(p, at(72 * H))).toBe(false); // "menos de 72 horas"
  });

  it("drafts and archived posts never reach the client", async () => {
    const org = await seedOrg(db, "Ocultos");
    await mkPost(org, { status: "rascunho" });
    await mkPost(org, { status: "em_aprovacao", archivedAt: t0 });
    await mkPost(org, { status: "aprovado", approvedAt: t0, archivedAt: t0 });
    expect(await listPostsForClient(db, org, at(H))).toEqual([]);
  });

  it("approved, scheduled and published share the 72 h window", async () => {
    const org = await seedOrg(db, "Tres");
    for (const status of ["aprovado", "agendado", "publicado"] as const) await mkPost(org, { status, approvedAt: t0 });
    expect(await listPostsForClient(db, org, at(H))).toHaveLength(3);
    expect(await listPostsForClient(db, org, at(73 * H))).toHaveLength(0);
    const noApproval = await mkPost(org, { status: "agendado", approvedAt: null });
    expect(isVisibleToClient(noApproval, at(H))).toBe(false);
  });

  it("em_aprovacao and ajuste_pedido are visible with no deadline", async () => {
    const org = await seedOrg(db, "SemPrazo");
    await mkPost(org, { status: "em_aprovacao" });
    await mkPost(org, { status: "ajuste_pedido" });
    expect(await listPostsForClient(db, org, at(1000 * H))).toHaveLength(2);
  });

  it("the SQL rule and the pure rule agree on every state and boundary", async () => {
    const org = await seedOrg(db, "Concorda");
    const states = ["rascunho", "em_aprovacao", "ajuste_pedido", "aprovado", "agendado", "publicado"] as const;
    for (const status of states) {
      for (const approvedAt of [null, t0]) for (const archivedAt of [null, t0]) await mkPost(org, { status, approvedAt, archivedAt });
    }
    const all = await db.select().from(schema.contentPost).where(eq(schema.contentPost.organizationId, org));
    for (const now of [at(H), at(72 * H - 1), at(72 * H), at(72 * H + 1)]) {
      const expected = all.filter((p) => isVisibleToClient(p, now)).map((p) => p.id).sort();
      const got = (await listPostsForClient(db, org, now)).map((p) => p.id).sort();
      expect(got).toEqual(expected);
    }
  });

  it("daysLeft counts whole days of the window and never goes negative", () => {
    expect(daysLeft(null, t0)).toBeNull();
    expect(daysLeft(t0, t0)).toBe(3);
    expect(daysLeft(t0, at(25 * H))).toBe(2);
    expect(daysLeft(t0, at(71 * H))).toBe(1);
    expect(daysLeft(t0, at(100 * H))).toBe(0);
  });

  it("lists never return another organization's posts", async () => {
    const a = await seedOrg(db, "ListaA");
    const b = await seedOrg(db, "ListaB");
    const pa = await mkPost(a, { status: "em_aprovacao" });
    await mkPost(b, { status: "em_aprovacao" });
    expect((await listPostsForClient(db, a, t0)).map((p) => p.id)).toEqual([pa.id]);
    expect((await listPostsForStaff(db, a, { archived: false })).map((p) => p.id)).toEqual([pa.id]);
  });
});

describe("share link", () => {
  it("creates one active link, returns the same one, and the token has 24 url-safe characters", async () => {
    const org = await seedOrg(db, "LinkUm");
    const a = await ensureShare(db, org);
    const b = await ensureShare(db, org);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(b.token).toBe(a.token);
    expect((await getActiveShare(db, org))?.token).toBe(a.token);
  });

  it("regenerating the link revokes the old token", async () => {
    const org = await seedOrg(db, "LinkDois");
    const old = await ensureShare(db, org);
    const fresh = await regenerateShare(db, org);
    expect(fresh.token).not.toBe(old.token);
    expect(await resolveShare(db, old.token)).toBeNull();
    expect(await resolveShare(db, fresh.token)).toEqual({ organizationId: org });
  });

  it("resolveShare returns null for unknown, malformed and revoked tokens", async () => {
    expect(await resolveShare(db, "x".repeat(24))).toBeNull();
    expect(await resolveShare(db, "curto")).toBeNull();
    expect(await resolveShare(db, "../../etc/passwd")).toBeNull();
    expect(await resolveShare(db, "")).toBeNull();
  });
});

describe("decide", () => {
  it("approving twice records one event and returns ja_decidido", async () => {
    const org = await seedOrg(db, "Duas");
    const p = await mkPost(org, { status: "em_aprovacao" });
    const events: ContentEventInfo[] = [];
    expect(await decide(db, decideDeps(t0, events), { organizationId: org, postId: p.id, decision: "aprovar" })).toBe("ok");
    expect(await decide(db, decideDeps(at(H), events), { organizationId: org, postId: p.id, decision: "aprovar" })).toBe("ja_decidido");
    expect((await eventsOf(p.id)).filter((e) => e.type === "aprovado")).toHaveLength(1);
    expect(events).toHaveLength(1);
    const [row] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, p.id));
    expect(row.status).toBe("aprovado");
    expect(row.approvedAt?.getTime()).toBe(t0.getTime());
  });

  it("an adjustment without a comment is refused; with a comment it records the text", async () => {
    const org = await seedOrg(db, "Ajuste");
    const p = await mkPost(org, { status: "em_aprovacao" });
    await expect(decide(db, decideDeps(t0), { organizationId: org, postId: p.id, decision: "ajuste", comment: "   " })).rejects.toThrow(/o que precisa mudar/i);
    await expect(decide(db, decideDeps(t0), { organizationId: org, postId: p.id, decision: "ajuste", comment: "x".repeat(1001) })).rejects.toThrow();
    expect(await decide(db, decideDeps(t0), { organizationId: org, postId: p.id, decision: "ajuste", comment: " Trocar a foto " })).toBe("ok");
    const [row] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, p.id));
    expect(row).toMatchObject({ status: "ajuste_pedido", clientFeedback: "Trocar a foto" });
    expect((await eventsOf(p.id))[0]).toMatchObject({ type: "ajuste_pedido", text: "Trocar a foto" });
  });

  it("approving after asking for adjustment works", async () => {
    const org = await seedOrg(db, "MudouDeIdeia");
    const p = await mkPost(org, { status: "ajuste_pedido" });
    expect(await decide(db, decideDeps(t0), { organizationId: org, postId: p.id, decision: "aprovar" })).toBe("ok");
  });

  it("deciding a hidden, draft or other organization's post returns indisponivel", async () => {
    const org = await seedOrg(db, "Indisp");
    const other = await seedOrg(db, "IndispOutra");
    const draft = await mkPost(org, { status: "rascunho" });
    const old = await mkPost(org, { status: "aprovado", approvedAt: t0 });
    const archived = await mkPost(org, { status: "em_aprovacao", archivedAt: t0 });
    const foreign = await mkPost(other, { status: "em_aprovacao" });
    for (const [postId, now] of [[draft.id, t0], [old.id, at(80 * H)], [archived.id, t0], [foreign.id, t0]] as const) {
      expect(await decide(db, decideDeps(now), { organizationId: org, postId, decision: "aprovar" })).toBe("indisponivel");
    }
    expect(await decide(db, decideDeps(t0), { organizationId: org, postId: "nao-existe", decision: "aprovar" })).toBe("indisponivel");
    const [stillOpen] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, foreign.id));
    expect(stillOpen.status).toBe("em_aprovacao");
  });

  it("each decision creates a notice and calls onEvent with the organization and post", async () => {
    const org = await seedOrg(db, "Aviso");
    const p = await mkPost(org, { status: "em_aprovacao", title: "Reels de novembro" });
    const events: ContentEventInfo[] = [];
    await decide(db, decideDeps(t0, events), { organizationId: org, postId: p.id, decision: "ajuste", comment: "Música mais baixa" });
    const notices = await db.select().from(schema.contentNotice).where(eq(schema.contentNotice.organizationId, org));
    expect(notices).toHaveLength(1);
    expect(notices[0].sentAt).toBeNull();
    expect(events[0]).toMatchObject({ organizationId: org, organizationName: "Aviso", postId: p.id, postTitle: "Reels de novembro", type: "ajuste_pedido", text: "Música mais baixa" });
  });

  it("two simultaneous approvals record only one event", async () => {
    const org = await seedOrg(db, "Simultaneas");
    const p = await mkPost(org, { status: "em_aprovacao" });
    const results = await Promise.all([1, 2, 3].map(() => decide(db, decideDeps(t0), { organizationId: org, postId: p.id, decision: "aprovar" })));
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect((await eventsOf(p.id)).filter((e) => e.type === "aprovado")).toHaveLength(1);
  });
});

describe("post lifecycle", () => {
  it("creates, edits and sends for approval, recording events", async () => {
    const org = await seedOrg(db, "Ciclo");
    const p = await createPost(db, org, { format: "carrossel", title: "Dicas", caption: "Legenda", scheduledAt: at(48 * H) });
    expect(p.status).toBe("rascunho");
    await updatePost(db, org, p.id, { caption: "Legenda nova" }); // rascunho: sem evento
    expect(await eventsOf(p.id)).toHaveLength(0);
    await setStatus(db, org, p.id, "em_aprovacao");
    await updatePost(db, org, p.id, { title: "Dicas rápidas" });
    expect((await eventsOf(p.id)).map((e) => e.type).sort()).toEqual(["editado", "enviado"]);
  });

  it("refuses captions over 2200 characters and unknown posts of another organization", async () => {
    const org = await seedOrg(db, "Limites");
    const other = await seedOrg(db, "LimitesOutra");
    await expect(createPost(db, org, { format: "feed", caption: "x".repeat(2201) })).rejects.toThrow(/2\.?200/);
    const p = await createPost(db, org, { format: "feed" });
    await expect(updatePost(db, other, p.id, { title: "invasão" })).rejects.toThrow();
    await expect(setStatus(db, other, p.id, "em_aprovacao")).rejects.toThrow();
  });

  it("reopening clears the approval and the post is visible again", async () => {
    const org = await seedOrg(db, "Reabre");
    const p = await mkPost(org, { status: "aprovado", approvedAt: t0 });
    expect(await listPostsForClient(db, org, at(80 * H))).toEqual([]);
    await reopenPost(db, org, p.id);
    const [row] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, p.id));
    expect(row).toMatchObject({ status: "em_aprovacao", approvedAt: null });
    expect(await listPostsForClient(db, org, at(80 * H))).toHaveLength(1);
    expect((await eventsOf(p.id)).map((e) => e.type)).toEqual(["reaberto"]);
  });

  it("archiving hides the post from the client and moves it to the archived tab", async () => {
    const org = await seedOrg(db, "Arquiva");
    const p = await mkPost(org, { status: "em_aprovacao" });
    await archivePost(db, org, p.id);
    expect(await listPostsForClient(db, org, t0)).toEqual([]);
    expect(await listPostsForStaff(db, org, { archived: false })).toEqual([]);
    expect((await listPostsForStaff(db, org, { archived: true })).map((x) => x.id)).toEqual([p.id]);
  });

  it("scheduled and published keep the approval date; sending again clears it", async () => {
    const org = await seedOrg(db, "Agenda");
    const p = await mkPost(org, { status: "aprovado", approvedAt: t0 });
    await setStatus(db, org, p.id, "agendado");
    await setStatus(db, org, p.id, "publicado");
    let [row] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, p.id));
    expect(row.approvedAt?.getTime()).toBe(t0.getTime());
    expect(row.publishedAt).not.toBeNull();
    await setStatus(db, org, p.id, "em_aprovacao");
    [row] = await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, p.id));
    expect(row.approvedAt).toBeNull();
  });

  it("deletePost removes rows and asks the storage to remove the files", async () => {
    const org = await seedOrg(db, "Apaga");
    const p = await mkPost(org);
    await db.insert(schema.contentMedia).values([
      { organizationId: org, postId: p.id, kind: "image", position: 0, fileKey: "a.jpg", mime: "image/jpeg", bytes: 1 },
      { organizationId: org, postId: p.id, kind: "image", position: 1, fileKey: "b.jpg", mime: "image/jpeg", bytes: 1 },
    ]);
    const removed: string[] = [];
    await deletePost(db, { remove: async (o, k) => void removed.push(`${o}/${k}`) }, org, p.id);
    expect(removed.sort()).toEqual([`${org}/a.jpg`, `${org}/b.jpg`]);
    expect(await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, p.id))).toHaveLength(0);
    expect(await db.select().from(schema.contentMedia).where(eq(schema.contentMedia.postId, p.id))).toHaveLength(0);
  });

  it("deletePost of another organization's post changes nothing", async () => {
    const org = await seedOrg(db, "ApagaA");
    const other = await seedOrg(db, "ApagaB");
    const p = await mkPost(org);
    const removed: string[] = [];
    await expect(deletePost(db, { remove: async (_o, k) => void removed.push(k) }, other, p.id)).rejects.toThrow();
    expect(removed).toEqual([]);
    expect(await db.select().from(schema.contentPost).where(eq(schema.contentPost.id, p.id))).toHaveLength(1);
  });

  it("client posts come with their media in order", async () => {
    const org = await seedOrg(db, "Midias");
    const p = await mkPost(org, { status: "em_aprovacao" });
    await db.insert(schema.contentMedia).values([
      { organizationId: org, postId: p.id, kind: "image", position: 1, fileKey: "2.jpg", mime: "image/jpeg", bytes: 1 },
      { organizationId: org, postId: p.id, kind: "image", position: 0, fileKey: "1.jpg", mime: "image/jpeg", bytes: 1 },
    ]);
    const [got] = await listPostsForClient(db, org, t0);
    expect(got.media.map((m) => m.fileKey)).toEqual(["1.jpg", "2.jpg"]);
    expect(got.daysLeft).toBeNull();
  });
});

describe("pending actions", () => {
  it("lists approvals and adjustments not handled yet, counts per organization, and marks handled", async () => {
    const a = await seedOrg(db, "FilaA");
    const b = await seedOrg(db, "FilaB");
    const pa1 = await mkPost(a, { status: "em_aprovacao", title: "Um" });
    const pa2 = await mkPost(a, { status: "em_aprovacao", title: "Dois" });
    const pb = await mkPost(b, { status: "em_aprovacao" });
    await decide(db, decideDeps(t0), { organizationId: a, postId: pa1.id, decision: "aprovar" });
    await decide(db, decideDeps(t0), { organizationId: a, postId: pa2.id, decision: "ajuste", comment: "Trocar" });
    await decide(db, decideDeps(t0), { organizationId: b, postId: pb.id, decision: "aprovar" });
    const forA = await listPendingActions(db, a);
    expect(forA.map((e) => [e.postTitle, e.type]).sort()).toEqual([["Dois", "ajuste_pedido"], ["Um", "aprovado"]]);
    expect(forA[0].organizationName).toBe("FilaA");
    expect((await countPendingActions(db))[a]).toBe(2);
    expect((await countPendingActions(db))[b]).toBe(1);
    expect((await listPendingActions(db, null)).length).toBeGreaterThanOrEqual(3);
    await markHandled(db, a, forA[0].id);
    expect((await countPendingActions(db))[a]).toBe(1);
    await expect(markHandled(db, b, forA[1].id)).rejects.toThrow(); // evento de outra empresa
  });
});
