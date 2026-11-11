import "server-only";
import { notifyWebhook } from "./notify";
import type { ContentEventInfo } from "./types";

/** Aviso de uma decisão do cliente: o webhook sai sem ninguém esperar (a decisão nunca fica presa nele). */
export function onContentEvent(info: ContentEventInfo): void {
  void notifyWebhook(process.env.CONTENT_NOTIFY_WEBHOOK_URL?.trim(), info);
}
