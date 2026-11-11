import type { Db } from "@dynamo/db";
import type { BotConfig } from "../../src/config";
import type { ToolContext } from "../../src/tools";

export function makeCtx(db: Db, organizationId: string, conversationId: string, config: BotConfig, over: Partial<ToolContext> = {}) {
  const notified: { to: string; text: string }[] = [];
  const posted: { url: string; body: unknown }[] = [];
  const ctx: ToolContext = {
    db,
    organizationId,
    conversationId,
    waId: "5527988887777",
    contactName: "Ana",
    config,
    testMode: false,
    notify: async (to, text) => {
      notified.push({ to, text });
    },
    fetch: (async (url: string, init: RequestInit) => {
      posted.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch,
    ...over,
  };
  return { ctx, notified, posted };
}
