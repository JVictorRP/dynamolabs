import { describe, expect, it, vi } from "vitest";
import { createPublicLeadHandler, type IncomingLead } from "../src/index";

const ORIGIN = "https://dynamo.business";

function setup(extra: { maxTrackedIps?: number; trustedProxyHops?: number } = {}) {
  let clock = Date.UTC(2026, 10, 6, 22, 14, 0);
  const ingest = vi.fn(async (_org: string, leads: IncomingLead[]) => ({ received: leads.length, inserted: leads.length }));
  const handle = createPublicLeadHandler({ ingest, now: () => clock, allowedOrigins: [ORIGIN], organizationId: "org", ...extra });
  return { handle, ingest, advance: (ms: number) => void (clock += ms) };
}

const body = (over: Record<string, unknown> = {}) => JSON.stringify({ name: "Maria", email: "maria@exemplo.com", ...over });
const post = (text: string, headers: Record<string, string> = {}) =>
  new Request("https://app.dynamo.business/api/public/lead", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: text,
  });

describe("reading the body safely (item: the whole body was buffered before the size check)", () => {
  it("answers 413 from the Content-Length header without reading a single byte of an enormous body", async () => {
    const { handle } = setup();
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(1000));
        await new Promise((resolve) => setTimeout(resolve, 0)); // cede ao laço de eventos: o timeout do teste precisa conseguir disparar
      },
    });
    const request = new Request("https://app.dynamo.business/api/public/lead", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json", "content-length": "200000000" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const res = await handle(request);
    expect(res.status).toBe(413);
    // O próprio ReadableStream faz 1 pull inicial no tick seguinte à criação; um handler que lesse o corpo puxaria milhares.
    expect(pulled).toBeLessThanOrEqual(1);
  }, 3000);

  it("stops reading a chunked body that never ends as soon as it passes the limit", async () => {
    const { handle } = setup();
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(1000)); // sem Content-Length: nunca termina sozinho
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
    });
    const request = new Request("https://app.dynamo.business/api/public/lead", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const res = await handle(request);
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThanOrEqual(15);
  }, 3000);

  it("counts bytes, not characters: a normal body with accents and emoji still fits", async () => {
    const { handle } = setup();
    expect((await handle(post(body({ name: "João 🌿 D'Ávila", message: "ç".repeat(1500) })))).status).toBe(201);
  });
});

describe("rate limit keyed by the address the proxy saw (item: the first X-Forwarded-For entry is client-controlled)", () => {
  it("ignores spoofed leading X-Forwarded-For entries: the last hop (added by our proxy) is the bucket", async () => {
    const { handle } = setup();
    for (let i = 0; i < 5; i++) {
      const res = await handle(post(body({ email: `p${i}@exemplo.com` }), { "x-forwarded-for": `10.0.0.${i}, 203.0.113.9` }));
      expect(res.status).toBe(201);
    }
    const sixth = await handle(post(body({ email: "p6@exemplo.com" }), { "x-forwarded-for": "10.9.9.9, 203.0.113.9" }));
    expect(sixth.status).toBe(429);
  });

  it("can be told how many trusted proxies sit in front (2 hops: the second-to-last entry)", async () => {
    const { handle } = setup({ trustedProxyHops: 2 });
    for (let i = 0; i < 5; i++) await handle(post(body({ email: `h${i}@exemplo.com` }), { "x-forwarded-for": `1.1.1.${i}, 198.51.100.7, 192.0.2.1` }));
    expect((await handle(post(body({ email: "h9@exemplo.com" }), { "x-forwarded-for": "2.2.2.2, 198.51.100.7, 192.0.2.1" }))).status).toBe(429);
  });
});

describe("bounded memory (item: the tracking map grew without a ceiling)", () => {
  it("fails closed with 429 when too many distinct addresses are being tracked, and recovers once the window passes", async () => {
    const { handle, advance } = setup({ maxTrackedIps: 3 });
    for (let i = 1; i <= 3; i++) expect((await handle(post(body({ email: `m${i}@exemplo.com` }), { "x-forwarded-for": `198.51.100.${i}` }))).status).toBe(201);
    expect((await handle(post(body({ email: "m4@exemplo.com" }), { "x-forwarded-for": "198.51.100.4" }))).status).toBe(429);
    advance(10 * 60_000 + 61_000);
    expect((await handle(post(body({ email: "m5@exemplo.com" }), { "x-forwarded-for": "198.51.100.5" }))).status).toBe(201);
  });
});

describe("externalId and messages sent the same day (item: a second, different message was silently dropped)", () => {
  it("gives a different externalId to a different message from the same e-mail on the same day, and the same one to a repeat", async () => {
    const { handle, ingest, advance } = setup();
    await handle(post(body({ message: "Quero um orçamento" }), { "x-forwarded-for": "198.51.100.1" }));
    advance(60_000);
    await handle(post(body({ message: "Esqueci: preciso também de um site" }), { "x-forwarded-for": "198.51.100.2" }));
    advance(60_000);
    await handle(post(body({ message: "Quero um orçamento" }), { "x-forwarded-for": "198.51.100.3" }));
    const ids = ingest.mock.calls.map((c) => c[1][0].externalId);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toBe(ids[2]);
  });
});
