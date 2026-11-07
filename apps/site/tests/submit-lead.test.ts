import { describe, expect, it, vi } from "vitest";
import { submitLead } from "../src/lib/contact/submit-lead";

const input = { name: "Maria", email: "maria@exemplo.com", phone: "27999990000", message: "Oi" };
const reply = (status: number) => vi.fn(async () => new Response("{}", { status })) as unknown as typeof fetch;

describe("submitLead", () => {
  it("posts JSON to the endpoint, including an empty honeypot field", async () => {
    const fetchImpl = reply(201);
    await submitLead(input, "https://app.dynamo.business/api/public/lead", fetchImpl);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://app.dynamo.business/api/public/lead");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ ...input, website: "" });
  });

  it("maps the server's answers to a result the form can act on", async () => {
    expect(await submitLead(input, "/x", reply(201))).toEqual({ ok: true });
    expect(await submitLead(input, "/x", reply(200))).toEqual({ ok: true });
    expect(await submitLead(input, "/x", reply(400))).toEqual({ ok: false, reason: "invalid" });
    expect(await submitLead(input, "/x", reply(413))).toEqual({ ok: false, reason: "invalid" });
    expect(await submitLead(input, "/x", reply(429))).toEqual({ ok: false, reason: "rate" });
    expect(await submitLead(input, "/x", reply(500))).toEqual({ ok: false, reason: "network" });
    expect(await submitLead(input, "/x", reply(403))).toEqual({ ok: false, reason: "network" });
  });

  it("treats a network failure as 'network'", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await submitLead(input, "/x", failing)).toEqual({ ok: false, reason: "network" });
  });
});
