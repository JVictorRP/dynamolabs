import "server-only";
import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_GRAPH_VERSION,
  DEFAULT_USD_BRL,
  anthropicCreateMessage,
  createWhatsAppClient,
  type CreateMessage,
} from "@dynamo/chatbot";
import { getOrgContext } from "./context";

export const usdBrl = () => Number(process.env.USD_BRL_RATE) || DEFAULT_USD_BRL;
export const whatsapp = createWhatsAppClient({ graphVersion: process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION });

export function encKey(): string {
  const k = process.env.CHATBOT_ENC_KEY?.trim();
  if (!k) throw new Error("CHATBOT_ENC_KEY não configurada no CRM (Easypanel → ambiente do serviço).");
  return k;
}

let cached: CreateMessage | null = null;
/** Cliente do Claude, ou null quando ANTHROPIC_API_KEY não está configurada. */
export function createMessageOrNull(): CreateMessage | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  cached ??= anthropicCreateMessage(new Anthropic({ apiKey: key, maxRetries: 2 }));
  return cached;
}

export const canManageBot = (role: string) => role === "owner" || role === "admin";

/** Só dono e admin da empresa mexem no chatbot. */
export async function requireManager() {
  const ctx = await getOrgContext();
  if (!canManageBot(ctx.role)) redirect("/");
  return ctx;
}
