import { randomBytes } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { encrypt, type CreateMessage, type WhatsAppClient } from "@dynamo/chatbot";
import { schema, type Db } from "@dynamo/db";
import { seedOrg } from "@dynamo/db/testing";

export const ENC_KEY = randomBytes(32).toString("base64");

export async function seedBot(db: Db, name: string, opts: { enabled?: boolean; status?: "ativo" | "desligado" | "com_problema"; phoneNumberId?: string } = {}) {
  const org = await seedOrg(db, name);
  const phoneNumberId = opts.phoneNumberId ?? `PN-${name}`;
  await db.insert(schema.whatsappNumber).values({
    organizationId: org,
    phoneNumberId,
    wabaId: "WABA",
    displayPhone: "+55 27 99999-0000",
    accessTokenEnc: encrypt("TOKEN-" + name, ENC_KEY),
    status: opts.status ?? "ativo",
  });
  await db.insert(schema.botConfig).values({ organizationId: org, enabled: opts.enabled ?? true, ownerPhone: "5527999990000" });
  return { org, phoneNumberId };
}

export function fakeWhatsApp(opts: { failWith?: Error } = {}) {
  const sent: { phoneNumberId: string; token: string; to: string; body: string }[] = [];
  const read: string[] = [];
  let n = 0;
  const client: WhatsAppClient = {
    async sendText(num, to, body) {
      if (opts.failWith) throw opts.failWith;
      sent.push({ phoneNumberId: num.phoneNumberId, token: num.accessToken, to, body });
      n += 1;
      return { wamid: `wamid.out.${Date.now()}.${n}` };
    },
    async markRead(_num, wamid) {
      read.push(wamid);
    },
  };
  return { client, sent, read };
}

export function textReply(text: string): Anthropic.Message {
  return {
    id: "msg_x",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

export function fakeLlm(impl: () => Promise<Anthropic.Message>) {
  const calls: unknown[] = [];
  const create: CreateMessage = async (p) => {
    calls.push(p);
    return impl();
  };
  return { create, calls };
}
