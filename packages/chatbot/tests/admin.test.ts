import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { AdminError, deleteContactData, linkNumber, setNumberStatus } from "../src/admin";
import { recordIncoming } from "../src/conversations";
import { decrypt } from "../src/crypto";
import { incoming } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const KEY = randomBytes(32).toString("base64");
const slugOf = async (id: string) => (await db.select().from(schema.organization).where(eq(schema.organization.id, id)))[0].slug;
const input = (organizationSlug: string, over: Partial<Parameters<typeof linkNumber>[1]> = {}) => ({
  organizationSlug,
  phoneNumberId: "PN-LINK",
  wabaId: "WABA-1",
  displayPhone: "+55 27 99999-0000",
  accessToken: "EAAG-segredo",
  ...over,
});

describe("linkNumber", () => {
  it("stores the token encrypted and updates it on relink", async () => {
    const org = await seedOrg(db, "Liga");
    const slug = await slugOf(org);
    expect(await linkNumber(db, input(slug), KEY)).toEqual({ organizationId: org });
    let [n] = await db.select().from(schema.whatsappNumber).where(eq(schema.whatsappNumber.phoneNumberId, "PN-LINK"));
    expect(n.accessTokenEnc).not.toContain("EAAG");
    expect(decrypt(n.accessTokenEnc, KEY)).toBe("EAAG-segredo");
    await setNumberStatus(db, "PN-LINK", "com_problema");
    await linkNumber(db, input(slug, { accessToken: "EAAG-novo" }), KEY);
    [n] = await db.select().from(schema.whatsappNumber).where(eq(schema.whatsappNumber.phoneNumberId, "PN-LINK"));
    expect(decrypt(n.accessTokenEnc, KEY)).toBe("EAAG-novo");
    expect(n.status).toBe("ativo");
    expect(await db.select().from(schema.whatsappNumber).where(eq(schema.whatsappNumber.organizationId, org))).toHaveLength(1);
  });

  it("refuses unknown companies and numbers linked to another company", async () => {
    await expect(linkNumber(db, input("nao-existe", { phoneNumberId: "PN-X" }), KEY)).rejects.toBeInstanceOf(AdminError);
    const other = await seedOrg(db, "Outra");
    await expect(linkNumber(db, input(await slugOf(other)), KEY)).rejects.toThrow(/outra empresa/);
  });

  it("refuses a second, different number for the same company", async () => {
    const org = await seedOrg(db, "DoisNumeros");
    const slug = await slugOf(org);
    await linkNumber(db, input(slug, { phoneNumberId: "PN-A" }), KEY);
    await expect(linkNumber(db, input(slug, { phoneNumberId: "PN-B" }), KEY)).rejects.toThrow(/já tem/);
  });
});

describe("deleteContactData", () => {
  it("deletes only that contact's conversations in that company", async () => {
    const a = await seedOrg(db, "Titular");
    const b = await seedOrg(db, "TitularOutra");
    await recordIncoming(db, a, incoming({ waId: "5527998765432" }));
    await recordIncoming(db, a, incoming({ waId: "5527998765432" }));
    await recordIncoming(db, a, incoming({ waId: "5527911110000" }));
    await recordIncoming(db, b, incoming({ waId: "5527998765432" }));
    const r = await deleteContactData(db, await slugOf(a), "+55 (27) 99876-5432");
    expect(r).toEqual({ conversations: 1, messages: 2 });
    expect(await db.select().from(schema.conversation).where(eq(schema.conversation.organizationId, a))).toHaveLength(1);
    expect(await db.select().from(schema.conversation).where(eq(schema.conversation.organizationId, b))).toHaveLength(1);
  });
});
