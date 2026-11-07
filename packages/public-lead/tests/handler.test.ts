import { describe, expect, it, vi } from "vitest";
import { createPublicLeadHandler, type IncomingLead } from "../src/index";

const ORIGIN = "https://dynamo.business";
const ORG = "org-dynamo";

function setup(overrides: { now?: () => number } = {}) {
  let clock = Date.UTC(2026, 10, 6, 22, 14, 0);
  const now = overrides.now ?? (() => clock);
  const ingest = vi.fn(async (_org: string, leads: IncomingLead[]) => ({ received: leads.length, inserted: leads.length }));
  const handle = createPublicLeadHandler({ ingest, now, allowedOrigins: [ORIGIN], organizationId: ORG });
  return { handle, ingest, advance: (ms: number) => void (clock += ms) };
}

const post = (body: unknown, init: { origin?: string | null; ip?: string } = {}) =>
  new Request("https://app.dynamo.business/api/public/lead", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init.origin === null ? {} : { origin: init.origin ?? ORIGIN }),
      "x-forwarded-for": init.ip ?? "203.0.113.7",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const valid = (extra: Record<string, unknown> = {}) => ({ name: "Maria Souza", email: "maria@exemplo.com.br", phone: "27999990000", message: "Quero um orçamento", ...extra });

describe("accepting a lead", () => {
  it("creates the lead in the Dynamo organization with source 'site' and answers 201 with CORS for the site", async () => {
    const { handle, ingest } = setup();
    const res = await handle(post(valid()));
    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(ingest).toHaveBeenCalledTimes(1);
    const [org, leads] = ingest.mock.calls[0];
    expect(org).toBe(ORG);
    expect(leads[0]).toMatchObject({ source: "site", name: "Maria Souza", email: "maria@exemplo.com.br", phone: "27999990000" });
    expect(leads[0].fields).toMatchObject({ message: "Quero um orçamento" });
  });

  it("keeps accents and emoji in the name and lowercases the e-mail", async () => {
    const { handle, ingest } = setup();
    expect((await handle(post(valid({ name: "João 🌿 D'Ávila", email: "  JOAO@Exemplo.com " })))).status).toBe(201);
    expect(ingest.mock.calls[0][1][0]).toMatchObject({ name: "João 🌿 D'Ávila", email: "joao@exemplo.com" });
  });

  it("gives the same externalId to the same e-mail on the same day (so the CRM can deduplicate)", async () => {
    const { handle, ingest, advance } = setup();
    await handle(post(valid(), { ip: "198.51.100.1" }));
    advance(60_000);
    await handle(post(valid(), { ip: "198.51.100.2" }));
    expect(ingest.mock.calls[0][1][0].externalId).toBe(ingest.mock.calls[1][1][0].externalId);
    expect(ingest.mock.calls[0][1][0].externalId).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("rejecting bad requests", () => {
  it("answers 403 without CORS headers for an origin that is not on the list, and for a missing origin", async () => {
    const { handle, ingest } = setup();
    const evil = await handle(post(valid(), { origin: "https://evil.example" }));
    expect(evil.status).toBe(403);
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    expect((await handle(post(valid(), { origin: null }))).status).toBe(403);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("answers the preflight for the site with 204 and the allowed method", async () => {
    const { handle } = setup();
    const res = await handle(new Request("https://app.dynamo.business/api/public/lead", { method: "OPTIONS", headers: { origin: ORIGIN } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("content-type");
  });

  it("answers 400 for an invalid e-mail, a missing name, a 5,000-character name and broken JSON", async () => {
    const { handle, ingest } = setup();
    expect((await handle(post(valid({ email: "isso-nao-e-email" })))).status).toBe(400);
    expect((await handle(post(valid({ name: "   " })))).status).toBe(400);
    expect((await handle(post(valid({ name: "A".repeat(5000) })))).status).toBe(400);
    expect((await handle(post("{ not json"))).status).toBe(400);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("answers 413 for a huge body", async () => {
    const { handle } = setup();
    expect((await handle(post(valid({ message: "x".repeat(20_000) })))).status).toBe(413);
  });
});

describe("abuse protection", () => {
  it("silently drops a filled honeypot field: 200 and nothing is created", async () => {
    const { handle, ingest } = setup();
    const res = await handle(post(valid({ website: "http://spam.example" })));
    expect(res.status).toBe(200);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("limits each IP to 5 requests per 10 minutes (the 6th gets 429) and releases it afterwards", async () => {
    const { handle, ingest, advance } = setup();
    for (let i = 0; i < 5; i++) expect((await handle(post(valid({ email: `p${i}@exemplo.com` })))).status).toBe(201);
    const blocked = await handle(post(valid({ email: "p6@exemplo.com" })));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
    expect(ingest).toHaveBeenCalledTimes(5);
    advance(10 * 60_000 + 1);
    expect((await handle(post(valid({ email: "p7@exemplo.com" })))).status).toBe(201);
  });

  it("does not limit a different IP", async () => {
    const { handle } = setup();
    for (let i = 0; i < 5; i++) await handle(post(valid({ email: `q${i}@exemplo.com` }), { ip: "10.0.0.1" }));
    expect((await handle(post(valid({ email: "other@exemplo.com" }), { ip: "10.0.0.2" }))).status).toBe(201);
  });

  it("treats a double click as one lead: the same IP and e-mail within 10 seconds answers 200 without creating a second", async () => {
    const { handle, ingest, advance } = setup();
    expect((await handle(post(valid()))).status).toBe(201);
    advance(3_000);
    expect((await handle(post(valid()))).status).toBe(200);
    expect(ingest).toHaveBeenCalledTimes(1);
    advance(20_000);
    expect((await handle(post(valid()))).status).toBe(201);
    expect(ingest).toHaveBeenCalledTimes(2);
  });
});

describe("when the CRM fails", () => {
  it("answers 500 with a generic message (no internals) and lets the visitor retry later", async () => {
    const ingest = vi.fn(async () => {
      throw new Error("connection refused 10.0.3.4:5432");
    });
    const handle = createPublicLeadHandler({ ingest, now: () => 0, allowedOrigins: [ORIGIN], organizationId: ORG });
    const res = await handle(post(valid()));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("10.0.3.4");
  });
});
