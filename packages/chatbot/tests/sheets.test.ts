import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { createGoogleSheetFetcher, parseSpreadsheetUrl } from "../src/sheets/fetcher";
import { searchSheets } from "../src/sheets/search";
import { syncSheet } from "../src/sheets/sync";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const MENU = [
  ["Produto", "Preço", "Disponível"],
  ["Bacalhau à Gomes de Sá", "R$ 89,00", "sim"],
  [],
  ["Pastel de bacalhau (6 un.)", "R$ 32,00", "sim"],
  ["Vinho verde", "R$ 75,00", "não"],
];

async function source(orgId: string, label = "Cardápio") {
  const [s] = await db.insert(schema.sheetSource).values({ organizationId: orgId, spreadsheetId: "SHEET1", tab: "Cardápio", label }).returning();
  return s;
}

describe("parseSpreadsheetUrl", () => {
  it("reads the id from an edit link", () => {
    expect(parseSpreadsheetUrl("https://docs.google.com/spreadsheets/d/1AbC-xyz_123/edit#gid=0")).toBe("1AbC-xyz_123");
  });
  it("returns null for other links", () => {
    expect(parseSpreadsheetUrl("https://example.com/planilha")).toBeNull();
    expect(parseSpreadsheetUrl("não é link")).toBeNull();
  });
});

describe("createGoogleSheetFetcher", () => {
  it("calls the Sheets values endpoint with the encoded tab", async () => {
    const urls: string[] = [];
    const fetcher = createGoogleSheetFetcher("{}", {
      getToken: async () => "TOKEN",
      fetch: (async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify({ values: [["a"], ["1"]] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(await fetcher("SHEET1", "Cardápio 2026")).toEqual([["a"], ["1"]]);
    expect(urls[0]).toBe("https://sheets.googleapis.com/v4/spreadsheets/SHEET1/values/Card%C3%A1pio%202026");
  });
});

describe("syncSheet", () => {
  it("stores rows keyed by header and skips empty rows", async () => {
    const org = await seedOrg(db, "Sync");
    const s = await source(org);
    expect(await syncSheet(db, org, s.id, async () => MENU)).toEqual({ rows: 3 });
    const rows = await db.select().from(schema.sheetRow).where(eq(schema.sheetRow.sourceId, s.id));
    expect(rows.map((r) => r.data["Produto"])).toEqual(["Bacalhau à Gomes de Sá", "Pastel de bacalhau (6 un.)", "Vinho verde"]);
    const [after] = await db.select().from(schema.sheetSource).where(eq(schema.sheetSource.id, s.id));
    expect(after.lastSyncedAt).not.toBeNull();
    expect(after.lastError).toBeNull();
  });

  it("keeps the previous rows and records the error when fetching fails", async () => {
    const org = await seedOrg(db, "Falha");
    const s = await source(org);
    await syncSheet(db, org, s.id, async () => MENU);
    await expect(syncSheet(db, org, s.id, async () => { throw new Error("sem permissão"); })).rejects.toThrow("sem permissão");
    expect(await db.select().from(schema.sheetRow).where(eq(schema.sheetRow.sourceId, s.id))).toHaveLength(3);
    const [after] = await db.select().from(schema.sheetSource).where(eq(schema.sheetSource.id, s.id));
    expect(after.lastError).toContain("sem permissão");
  });

  it("refuses a source from another organization", async () => {
    const a = await seedOrg(db, "Dona");
    const b = await seedOrg(db, "Intrusa");
    const s = await source(a);
    await expect(syncSheet(db, b, s.id, async () => MENU)).rejects.toThrow();
  });
});

describe("searchSheets", () => {
  it("finds rows by word, plural forms and limit, only in the organization", async () => {
    const org = await seedOrg(db, "Busca");
    const other = await seedOrg(db, "Outra");
    const s = await source(org);
    await syncSheet(db, org, s.id, async () => MENU);
    const o = await source(other);
    await syncSheet(db, other, o.id, async () => MENU);

    const hits = await searchSheets(db, org, "bacalhau");
    expect(hits.map((h) => h.dados["Produto"])).toEqual(
      expect.arrayContaining(["Bacalhau à Gomes de Sá", "Pastel de bacalhau (6 un.)"]),
    );
    expect(hits).toHaveLength(2);
    expect(hits[0].planilha).toBe("Cardápio");

    expect((await searchSheets(db, org, "vinhos verdes")).map((h) => h.dados["Produto"])).toEqual(["Vinho verde"]);
    expect(await searchSheets(db, org, "bacalhau", { limit: 1 })).toHaveLength(1);
    expect(await searchSheets(db, org, "pizza")).toEqual([]);
  });

  it("falls back to a partial match when full-text finds nothing", async () => {
    const org = await seedOrg(db, "Parcial");
    const s = await source(org);
    await syncSheet(db, org, s.id, async () => MENU);
    expect((await searchSheets(db, org, "Gomes")).map((h) => h.dados["Produto"])).toEqual(["Bacalhau à Gomes de Sá"]);
    expect((await searchSheets(db, org, "R$ 32")).map((h) => h.dados["Produto"])).toEqual(["Pastel de bacalhau (6 un.)"]);
  });

  it("answers natural questions by ranking rows that match any word", async () => {
    const org = await seedOrg(db, "Natural");
    const s = await source(org);
    await syncSheet(db, org, s.id, async () => MENU);
    const hits = await searchSheets(db, org, "quanto custa o bacalhau?");
    expect(hits.map((h) => h.dados["Produto"])).toEqual(
      expect.arrayContaining(["Bacalhau à Gomes de Sá", "Pastel de bacalhau (6 un.)"]),
    );
  });
});
