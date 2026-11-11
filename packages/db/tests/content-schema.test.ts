import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../src/index";
import { createTestDb, seedOrg } from "../src/testing";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

async function post(orgId: string, over: Partial<typeof schema.contentPost.$inferInsert> = {}) {
  const [p] = await db.insert(schema.contentPost).values({ organizationId: orgId, ...over }).returning();
  return p;
}

describe("content schema", () => {
  it("accepts the ajuste_pedido status", async () => {
    const org = await seedOrg(db, "Status");
    const p = await post(org, { status: "ajuste_pedido" });
    expect(p.status).toBe("ajuste_pedido");
    expect(p.approvedAt).toBeNull();
    expect(p.archivedAt).toBeNull();
  });

  it("allows only one active share per organization but many revoked", async () => {
    const org = await seedOrg(db, "Link");
    await db.insert(schema.contentShare).values({ organizationId: org, token: "a".repeat(24), revokedAt: new Date() });
    await db.insert(schema.contentShare).values({ organizationId: org, token: "b".repeat(24), revokedAt: new Date() });
    await db.insert(schema.contentShare).values({ organizationId: org, token: "c".repeat(24) });
    await expect(db.insert(schema.contentShare).values({ organizationId: org, token: "d".repeat(24) })).rejects.toThrow();
    const other = await seedOrg(db, "LinkOutra");
    await db.insert(schema.contentShare).values({ organizationId: other, token: "e".repeat(24) });
  });

  it("rejects a repeated token", async () => {
    const org = await seedOrg(db, "Token");
    const other = await seedOrg(db, "TokenOutra");
    await db.insert(schema.contentShare).values({ organizationId: org, token: "z".repeat(24) });
    await expect(db.insert(schema.contentShare).values({ organizationId: other, token: "z".repeat(24) })).rejects.toThrow();
  });

  it("rejects two media at the same position of a post", async () => {
    const org = await seedOrg(db, "Posicao");
    const p = await post(org);
    const media = { organizationId: org, postId: p.id, kind: "image" as const, position: 0, fileKey: "k.jpg", mime: "image/jpeg", bytes: 10 };
    await db.insert(schema.contentMedia).values(media);
    await expect(db.insert(schema.contentMedia).values({ ...media, fileKey: "k2.jpg" })).rejects.toThrow();
    await db.insert(schema.contentMedia).values({ ...media, position: 1, fileKey: "k3.jpg" });
  });

  it("deletes media, events and notices with the post, and everything with the organization", async () => {
    const org = await seedOrg(db, "Cascata");
    const p = await post(org);
    await db.insert(schema.contentMedia).values({ organizationId: org, postId: p.id, kind: "video", position: 0, fileKey: "v.mp4", mime: "video/mp4", bytes: 5 });
    const [ev] = await db.insert(schema.contentEvent).values({ organizationId: org, postId: p.id, type: "aprovado" }).returning();
    await db.insert(schema.contentNotice).values({ organizationId: org, eventId: ev.id });
    await db.insert(schema.contentProfile).values({ organizationId: org, handle: "loja" });
    await db.insert(schema.contentShare).values({ organizationId: org, token: "q".repeat(24) });

    await db.delete(schema.contentPost).where(eq(schema.contentPost.id, p.id));
    expect(await db.select().from(schema.contentMedia).where(eq(schema.contentMedia.organizationId, org))).toHaveLength(0);
    expect(await db.select().from(schema.contentEvent).where(eq(schema.contentEvent.organizationId, org))).toHaveLength(0);
    expect(await db.select().from(schema.contentNotice).where(eq(schema.contentNotice.organizationId, org))).toHaveLength(0);

    await db.delete(schema.organization).where(eq(schema.organization.id, org));
    expect(await db.select().from(schema.contentProfile).where(eq(schema.contentProfile.organizationId, org))).toHaveLength(0);
    expect(await db.select().from(schema.contentShare).where(eq(schema.contentShare.organizationId, org))).toHaveLength(0);
  });
});
