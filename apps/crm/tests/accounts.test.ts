import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb } from "@dynamo/db/testing";
import { addMember, createClientAccount, generatePassword, getClient, listClients, resetMemberPassword, AccountError } from "../src/lib/accounts";
import { isStaffEmail } from "../src/lib/staff-core";

let db: Db;
let close: () => Promise<void>;
let auth: ReturnType<typeof makeAuth>;

function makeAuth(database: Db) {
  return betterAuth({
    baseURL: "http://localhost:3000",
    secret: "segredo-de-teste-com-mais-de-32-caracteres-aqui",
    database: drizzleAdapter(database, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    plugins: [organization({ allowUserToCreateOrganization: false })],
  });
}
const deps = async () => ({ db, authContext: await auth.$context });
const canLogin = async (email: string, password: string) => {
  try {
    await auth.api.signInEmail({ body: { email, password } });
    return true;
  } catch {
    return false;
  }
};

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  auth = makeAuth(db);
});
afterAll(() => close());

describe("isStaffEmail", () => {
  it("matches listed e-mails, ignoring case and spaces", () => {
    expect(isStaffEmail("Joao@Dynamo.business", " joao@dynamo.business , outra@x.com ")).toBe(true);
    expect(isStaffEmail("cliente@x.com", "joao@dynamo.business")).toBe(false);
    expect(isStaffEmail("joao@dynamo.business", undefined)).toBe(false);
    expect(isStaffEmail("", "")).toBe(false);
  });
});

describe("generatePassword", () => {
  it("makes 16 readable characters without ambiguous ones, different each time", () => {
    const a = generatePassword();
    expect(a).toHaveLength(16);
    expect(a).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    expect(generatePassword()).not.toBe(a);
  });
});

describe("createClientAccount", () => {
  it("creates the company and a login that works with the generated password", async () => {
    const r = await createClientAccount(await deps(), { empresa: "Pizzaria Bella", nome: "Ana", email: "Ana@Bella.com" });
    expect(r.login).toBe("ana@bella.com");
    expect(r.senha).toHaveLength(16);
    expect(r.apiKey).toMatch(/^dyn_/);
    expect(await canLogin("ana@bella.com", r.senha!)).toBe(true);
    const [m] = await db.select().from(schema.member).where(eq(schema.member.organizationId, r.organization.id));
    expect(m.role).toBe("owner");
  });

  it("refuses a duplicated company name", async () => {
    await expect(createClientAccount(await deps(), { empresa: "Pizzaria Bella", nome: "X", email: "x@x.com" })).rejects.toBeInstanceOf(AccountError);
  });

  it("links an existing person without changing their password", async () => {
    const first = await createClientAccount(await deps(), { empresa: "Loja Um", nome: "Rui", email: "rui@x.com" });
    const second = await createClientAccount(await deps(), { empresa: "Loja Dois", nome: "Rui", email: "rui@x.com" });
    expect(second.senha).toBeNull();
    expect(await canLogin("rui@x.com", first.senha!)).toBe(true);
  });
});

describe("addMember and resetMemberPassword", () => {
  it("adds a new person with a working password and refuses duplicates", async () => {
    const c = await createClientAccount(await deps(), { empresa: "Clínica Sorriso", nome: "Dona", email: "dona@sorriso.com" });
    const r = await addMember(await deps(), c.organization.id, { nome: "Bia", email: "bia@sorriso.com", papel: "member" });
    expect(r).toMatchObject({ login: "bia@sorriso.com", existing: false });
    expect(await canLogin("bia@sorriso.com", r.senha!)).toBe(true);
    await expect(addMember(await deps(), c.organization.id, { nome: "Bia", email: "BIA@sorriso.com", papel: "admin" })).rejects.toThrow(/já tem acesso/);
    const client = await getClient(db, c.organization.id);
    expect(client?.members.map((m) => [m.email, m.role]).sort()).toEqual([["bia@sorriso.com", "member"], ["dona@sorriso.com", "owner"]]);
  });

  it("resets a member's password and ends their sessions; refuses people of other companies", async () => {
    const c = await createClientAccount(await deps(), { empresa: "Academia Força", nome: "Leo", email: "leo@forca.com" });
    const other = await createClientAccount(await deps(), { empresa: "Outra Academia", nome: "Zé", email: "ze@outra.com" });
    const [leo] = await db.select().from(schema.user).where(eq(schema.user.email, "leo@forca.com"));
    await auth.api.signInEmail({ body: { email: "leo@forca.com", password: c.senha! } });
    const nova = await resetMemberPassword(await deps(), c.organization.id, leo.id);
    expect(nova).not.toBe(c.senha);
    expect(await canLogin("leo@forca.com", c.senha!)).toBe(false);
    expect(await canLogin("leo@forca.com", nova)).toBe(true);
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, leo.id))).toHaveLength(1); // só a do login acima com a senha nova
    await expect(resetMemberPassword(await deps(), other.organization.id, leo.id)).rejects.toBeInstanceOf(AccountError);
  });
});

describe("listClients", () => {
  it("lists companies with people count, leads this month and WhatsApp status", async () => {
    const c = await createClientAccount(await deps(), { empresa: "Lista Teste", nome: "Lu", email: "lu@lista.com" });
    await addMember(await deps(), c.organization.id, { nome: "Mo", email: "mo@lista.com", papel: "admin" });
    await db.insert(schema.lead).values({ organizationId: c.organization.id, name: "L1", source: "site" });
    const rows = await listClients(db, new Date());
    const row = rows.find((r) => r.id === c.organization.id)!;
    expect(row).toMatchObject({ name: "Lista Teste", members: 2, leadsThisMonth: 1, whatsappStatus: null });
  });
});
