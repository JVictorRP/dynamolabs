import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { recordIncoming, recordOutgoing } from "../src/conversations";
import { canReplyManually, isHumanMode, monthKey, monthSpendBrl, overCap, releaseToBot, setHumanMode } from "../src/rules";
import { incoming } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const H = 3600_000;
const now = new Date("2026-11-10T15:00:00Z");

describe("rules", () => {
  it("human mode holds until the deadline", () => {
    expect(isHumanMode({ mode: "humano", handoffUntil: new Date(now.getTime() + H) }, now)).toBe(true);
    expect(isHumanMode({ mode: "humano", handoffUntil: new Date(now.getTime() - 1) }, now)).toBe(false);
    expect(isHumanMode({ mode: "bot", handoffUntil: null }, now)).toBe(false);
  });

  it("manual replies are allowed only within 24 h of the customer's last message", () => {
    expect(canReplyManually({ lastCustomerAt: new Date(now.getTime() - 24 * H + 60_000) }, now)).toBe(true);
    expect(canReplyManually({ lastCustomerAt: new Date(now.getTime() - 24 * H - 60_000) }, now)).toBe(false);
    expect(canReplyManually({ lastCustomerAt: null }, now)).toBe(false);
  });

  it("sets and releases human mode", async () => {
    const org = await seedOrg(db, "Modo");
    const { conversationId } = await recordIncoming(db, org, incoming());
    await setHumanMode(db, org, conversationId, 12);
    let [c] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(c.mode).toBe("humano");
    expect(c.handoffUntil!.getTime() - Date.now()).toBeGreaterThan(11.9 * H);
    await releaseToBot(db, org, conversationId);
    [c] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(c).toMatchObject({ mode: "bot", handoffUntil: null });
  });

  it("sums the month's spend in São Paulo time, converted to BRL, for the organization only", async () => {
    const org = await seedOrg(db, "Gasto");
    const other = await seedOrg(db, "OutroGasto");
    const { conversationId } = await recordIncoming(db, org, incoming());
    const add = async (orgId: string, conv: string, cost: number, at: string) => {
      await recordOutgoing(db, orgId, conv, { author: "bot", text: "x", costUsd: cost });
      await db.update(schema.message).set({ createdAt: new Date(at) }).where(eq(schema.message.costUsd, cost.toFixed(6)));
    };
    await add(org, conversationId, 1.0, "2026-11-05T12:00:00Z");
    await add(org, conversationId, 2.0, "2026-11-01T02:00:00Z"); // 31/10 23h em São Paulo → mês anterior
    const o = await recordIncoming(db, other, incoming());
    await add(other, o.conversationId, 4.0, "2026-11-06T12:00:00Z");
    expect(await monthSpendBrl(db, org, now, 5.5)).toBeCloseTo(5.5, 6);
  });

  it("knows when the cap is reached and the month key", () => {
    expect(overCap(300, 300)).toBe(true);
    expect(overCap(299.99, 300)).toBe(false);
    expect(overCap(1, 0)).toBe(true);
    expect(monthKey(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11");
  });
});

describe("manual takeover (review re-graded 10)", () => {
  it("holds human mode with no deadline until released", async () => {
    expect(isHumanMode({ mode: "humano", handoffUntil: null }, now)).toBe(true);
    const org = await seedOrg(db, "Assumir");
    const { conversationId } = await recordIncoming(db, org, incoming());
    await setHumanMode(db, org, conversationId, null);
    const [c] = await db.select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    expect(c).toMatchObject({ mode: "humano", handoffUntil: null });
    expect(isHumanMode(c, new Date(Date.now() + 30 * 24 * 3600_000))).toBe(true);
  });
});
