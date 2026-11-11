import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createWhatsAppClient, WhatsAppAuthError, WhatsAppTemporaryError } from "../src/whatsapp/client";
import { verifySignature } from "../src/whatsapp/signature";
import { parseWebhook } from "../src/whatsapp/webhook-payload";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const sign = (body: string, secret: string) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

describe("verifySignature", () => {
  const body = '{"a":1}';
  it("accepts the right signature", () => expect(verifySignature(body, sign(body, "s3cr3t"), "s3cr3t")).toBe(true));
  it("rejects an altered body", () => expect(verifySignature('{"a":2}', sign(body, "s3cr3t"), "s3cr3t")).toBe(false));
  it("rejects a missing header", () => expect(verifySignature(body, null, "s3cr3t")).toBe(false));
  it("rejects a header without the sha256= prefix", () =>
    expect(verifySignature(body, sign(body, "s3cr3t").slice(7), "s3cr3t")).toBe(false));
  it("rejects when no secret is configured", () => expect(verifySignature(body, sign(body, ""), "")).toBe(false));
});

describe("parseWebhook", () => {
  it("reads a text message", () => {
    expect(parseWebhook(fixture("webhook-text.json"))).toEqual([
      {
        phoneNumberId: "PN1",
        waId: "5527988887777",
        contactName: "Ana Souza",
        wamid: "wamid.AAA",
        type: "text",
        text: "Oi, vocês têm bacalhau?",
        timestamp: new Date(1762800000 * 1000),
      },
    ]);
  });
  it("ignores status-only payloads", () => expect(parseWebhook(fixture("webhook-status.json"))).toEqual([]));
  it("keeps non-text messages without text", () => {
    const [m] = parseWebhook(fixture("webhook-image.json"));
    expect(m.type).toBe("image");
    expect(m.text).toBeNull();
  });
  it("tolerates garbage", () => {
    expect(parseWebhook({})).toEqual([]);
    expect(parseWebhook(null)).toEqual([]);
    expect(parseWebhook({ entry: [{ changes: [{ value: { messages: [{ id: "x" }] } }] }] })).toEqual([]);
  });
});

type Call = { url: string; init: RequestInit };
function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const number = { phoneNumberId: "PN1", accessToken: "TOKEN" };

describe("WhatsApp client", () => {
  it("sends a text message to the Graph API", async () => {
    const f = fakeFetch([{ status: 200, body: { messages: [{ id: "wamid.OUT" }] } }]);
    const wa = createWhatsAppClient({ graphVersion: "v24.0", fetch: f.fn });
    expect(await wa.sendText(number, "5527988887777", "Olá!")).toEqual({ wamid: "wamid.OUT" });
    expect(f.calls[0].url).toBe("https://graph.facebook.com/v24.0/PN1/messages");
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN");
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({
      messaging_product: "whatsapp",
      to: "5527988887777",
      type: "text",
      text: { body: "Olá!" },
    });
  });
  it("splits texts longer than 4096 characters", async () => {
    const f = fakeFetch([{ status: 200, body: { messages: [{ id: "wamid.1" }] } }]);
    const wa = createWhatsAppClient({ graphVersion: "v24.0", fetch: f.fn });
    const long = ("palavra ".repeat(625)).trim(); // ~5000 caracteres
    await wa.sendText(number, "55", long);
    expect(f.calls).toHaveLength(2);
    for (const c of f.calls) expect(JSON.parse(String(c.init.body)).text.body.length).toBeLessThanOrEqual(4096);
  });
  it("marks a message as read", async () => {
    const f = fakeFetch([{ status: 200, body: { success: true } }]);
    await createWhatsAppClient({ graphVersion: "v24.0", fetch: f.fn }).markRead(number, "wamid.AAA");
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({ messaging_product: "whatsapp", status: "read", message_id: "wamid.AAA" });
  });
  it("raises WhatsAppAuthError on 401", async () => {
    const f = fakeFetch([{ status: 401, body: { error: { code: 190, message: "expired" } } }]);
    await expect(createWhatsAppClient({ graphVersion: "v24.0", fetch: f.fn }).sendText(number, "55", "x")).rejects.toBeInstanceOf(WhatsAppAuthError);
  });
  it("raises WhatsAppTemporaryError on 503", async () => {
    const f = fakeFetch([{ status: 503, body: {} }]);
    await expect(createWhatsAppClient({ graphVersion: "v24.0", fetch: f.fn }).sendText(number, "55", "x")).rejects.toBeInstanceOf(WhatsAppTemporaryError);
  });
});
