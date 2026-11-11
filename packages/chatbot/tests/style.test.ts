import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { createTestDb, seedOrg } from "@dynamo/db/testing";
import { anonymize, discoverNames } from "../src/style/anonymize";
import { extractExamples } from "../src/style/examples";
import { importStyleExport } from "../src/style/import";
import { listAuthors, parseExport, type ChatLine } from "../src/style/parse-export";

const bytes = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const at = (d: number, h: number, mi: number) => new Date(Date.UTC(2026, 10, d, h + 3, mi));

const EXPECTED: Omit<ChatLine, "at">[] = [
  { author: "Maria Souza", text: "Oi, boa tarde!" },
  { author: "Maria Souza", text: "Vocês entregam no centro?" },
  { author: "João Dynamo", text: "Boa tarde, Maria! Entregamos sim 😊\nTaxa de R$ 8.\nPedido até 19h." },
  { author: "João Dynamo", text: "Recebi a foto" },
  { author: "Maria Souza", text: "meu zap é (27) 99876-5432" },
  { author: "João Dynamo", text: "Anotado!" },
];

describe("parseExport", () => {
  it("reads an Android export (2-digit years, 'às', system line, hidden media, multi-line)", () => {
    const lines = parseExport({ fileName: "Conversa do WhatsApp com Maria.txt", bytes: bytes("android.txt") });
    expect(lines.map(({ author, text }) => ({ author, text }))).toEqual(EXPECTED);
    expect(lines[0].at.getTime()).toBe(at(10, 14, 31).getTime());
  });

  it("reads an iPhone export the same way (LRM marks, optional seconds, narrow spaces)", () => {
    const lines = parseExport({ fileName: "_chat.txt", bytes: bytes("iphone.txt") });
    expect(lines.map(({ author, text }) => ({ author, text }))).toEqual(EXPECTED);
  });

  it("reads the .txt inside a .zip", () => {
    const zip = zipSync({ "_chat.txt": bytes("iphone.txt"), "IMG-001.jpg": strToU8("x") });
    const lines = parseExport({ fileName: "WhatsApp Chat - Maria.zip", bytes: zip });
    expect(lines.map(({ author, text }) => ({ author, text }))).toEqual(EXPECTED);
  });

  it("lists authors by message count", () => {
    const lines = parseExport({ fileName: "a.txt", bytes: bytes("android.txt") });
    expect(listAuthors(lines)).toEqual([
      { author: "João Dynamo", count: 3 },
      { author: "Maria Souza", count: 3 },
    ]);
  });
});

describe("anonymize", () => {
  it("removes names, CPF, phones and e-mails", () => {
    expect(
      anonymize("Oi Maria Souza, meu cpf é 123.456.789-09 e zap (27) 99876-5432, maria@x.com", ["Maria Souza"]),
    ).toBe("Oi [CLIENTE], meu cpf é [CPF] e zap [TELEFONE], [EMAIL]");
  });
  it("matches first names regardless of accents and case, as whole words", () => {
    expect(anonymize("valeu, JOSE! Mariana não é a Maria.", ["José Lima", "Maria"])).toBe(
      "valeu, [CLIENTE]! Mariana não é a [CLIENTE].",
    );
  });
  it("removes CNPJ, CEP and international phones", () => {
    expect(anonymize("CNPJ 12.345.678/0001-90, CEP 29100-000, +55 27 99876 5432", [])).toBe(
      "CNPJ [CNPJ], CEP [CEP], [TELEFONE]",
    );
  });
});

describe("extractExamples", () => {
  const line = (author: string, text: string): ChatLine => ({ author, text, at: new Date() });
  it("pairs the customer's turn with the agent's reply, joining consecutive messages", () => {
    const pairs = extractExamples(
      [line("C", "oi"), line("C", "tem mesa?"), line("A", "Tem sim!"), line("A", "Pra quantas pessoas?")],
      "A",
    );
    expect(pairs).toEqual([{ customerText: "oi\ntem mesa?", agentText: "Tem sim!\nPra quantas pessoas?" }]);
  });
  it("keeps short replies like 'ok' but drops one-letter ones and duplicates", () => {
    const pairs = extractExamples(
      [line("C", "obrigado"), line("A", "ok"), line("C", "beleza"), line("A", "k"), line("C", "obrigado"), line("A", "ok")],
      "A",
    );
    expect(pairs).toEqual([{ customerText: "obrigado", agentText: "ok" }]);
  });
  it("drops replies longer than 1000 characters", () => {
    expect(extractExamples([line("C", "oi"), line("A", "x".repeat(1001))], "A")).toEqual([]);
  });
});

describe("importStyleExport", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(async () => ({ db, close } = await createTestDb()));
  afterAll(() => close());

  it("stores anonymized examples for the organization only", async () => {
    const orgA = await seedOrg(db, "A");
    const orgB = await seedOrg(db, "B");
    const r = await importStyleExport(db, orgA, { fileName: "a.txt", bytes: bytes("android.txt") }, "João Dynamo");
    expect(r.examples).toBe(2);
    const rows = await db.select().from(schema.styleExample).where(eq(schema.styleExample.organizationId, orgA));
    expect(rows).toHaveLength(2);
    const all = rows.map((x) => x.customerText + x.agentText).join(" ");
    expect(all).not.toMatch(/\d{4}-\d{4}/);
    expect(all).not.toContain("Maria");
    expect(all).toContain("[TELEFONE]");
    const [upload] = await db.select().from(schema.styleUpload).where(eq(schema.styleUpload.id, r.uploadId));
    expect(upload).toMatchObject({ organizationId: orgA, agentName: "João Dynamo", examples: 2 });
    expect(await db.select().from(schema.styleExample).where(eq(schema.styleExample.organizationId, orgB))).toHaveLength(0);
  });

  it("refuses an agent name that is not in the file", async () => {
    const org = await seedOrg(db, "C");
    await expect(importStyleExport(db, org, { fileName: "a.txt", bytes: bytes("android.txt") }, "Fulano")).rejects.toThrow(/atendente/);
  });
});

describe("anonymization of unsaved contacts (review important 3)", () => {
  const line = (author: string, text: string): ChatLine => ({ author, text, at: new Date() });

  it("finds names from self-introductions and greetings", () => {
    const lines = [
      line("+55 27 98888-7777", "Oi, sou a Maria Souza, queria um orçamento"),
      line("Atendente", "Boa tarde, Maria! Claro."),
      line("+55 27 91111-2222", "meu nome é joão"),
      line("Atendente", "Obrigado, Carlos! Até logo."),
      line("+55 27 93333-4444", "Aqui é o Pedro da padaria"),
    ];
    expect(discoverNames(lines).sort()).toEqual(["Carlos", "Maria Souza", "Pedro", "joão"].sort());
  });

  it("does not take common words after greetings as names", () => {
    expect(discoverNames([line("A", "Bom dia, Tudo bem?"), line("A", "Obrigado, Sim claro"), line("A", "Oi, Pessoal!")])).toEqual([]);
  });

  it("masks street addresses with numbers", () => {
    expect(anonymize("Entrego na Rua das Flores, 123, ap 4", [])).toBe("Entrego na [ENDERECO], ap 4");
    expect(anonymize("fica na Av. Vitória 1500", [])).toBe("fica na [ENDERECO]");
    expect(anonymize("Avenida Nossa Senhora da Penha, nº 570", [])).toBe("[ENDERECO]");
  });

  it("import removes the customer's name when the author is a phone number", async () => {
    const { db, close } = await createTestDb();
    const org = await seedOrg(db, "SemContato");
    const txt = [
      "10/11/2026 14:31 - +55 27 98888-7777: Oi, sou a Maria Souza, queria um orçamento",
      "10/11/2026 14:32 - Atendente: Boa tarde, Maria! Me passa o endereço?",
      "10/11/2026 14:33 - +55 27 98888-7777: Rua das Flores, 123",
      "10/11/2026 14:34 - Atendente: Perfeito, Maria. Entregamos aí!",
    ].join("\n");
    await importStyleExport(db, org, { fileName: "c.txt", bytes: new TextEncoder().encode(txt) }, "Atendente");
    const rows = await db.select().from(schema.styleExample).where(eq(schema.styleExample.organizationId, org));
    const all = rows.map((r) => r.customerText + " " + r.agentText).join(" ");
    expect(all).not.toMatch(/Maria|Souza|Flores|123|98888/);
    expect(all).toContain("[CLIENTE]");
    expect(all).toContain("[ENDERECO]");
    await close();
  });
});
