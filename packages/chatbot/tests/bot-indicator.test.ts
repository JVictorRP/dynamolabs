import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { botIndicator, indicatorOf } from "../src/panel";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

describe("indicatorOf", () => {
  it("is on only when the bot is enabled and the number is connected", () => {
    expect(indicatorOf(true, "ativo")).toBe("on");
  });
  it("is off whenever the bot is disabled, whatever the number status", () => {
    expect(indicatorOf(false, "ativo")).toBe("off");
    expect(indicatorOf(false, "com_problema")).toBe("off");
    expect(indicatorOf(false, null)).toBe("off");
  });
  it("flags an error when the bot is enabled but the number has a problem, since it would not answer", () => {
    expect(indicatorOf(true, "com_problema")).toBe("erro");
  });
  it("is off when the bot is enabled but there is no usable number", () => {
    expect(indicatorOf(true, null)).toBe("off");
    expect(indicatorOf(true, "desligado")).toBe("off");
  });
});

describe("botIndicator", () => {
  it("reads the company's own config and number", async () => {
    const org = await seedOrg(db, "Indicador");
    expect(await botIndicator(db, org)).toBe("off"); // sem configuração: o padrão é desligado
    await db.insert(schema.whatsappNumber).values({ organizationId: org, phoneNumberId: "PN-IND", wabaId: "W", displayPhone: "+55", accessTokenEnc: "x", status: "ativo" });
    await db.insert(schema.botConfig).values({ organizationId: org, enabled: true }).onConflictDoUpdate({ target: schema.botConfig.organizationId, set: { enabled: true } });
    expect(await botIndicator(db, org)).toBe("on");
  });
});
