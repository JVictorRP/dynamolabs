/** HTTP do bot: verificação e recebimento do webhook da Meta, e /health. */
import type { IncomingMessage as Req, ServerResponse } from "node:http";
import { sql } from "drizzle-orm";
import { findNumber, getConfig, parseWebhook, recordIncoming, scheduleReply, verifySignature } from "@dynamo/chatbot";
import type { Db } from "@dynamo/db";

const MAX_BODY = 1024 * 1024;

class TooLarge extends Error {}

function readBody(req: Req): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new TooLarge());
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8") {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

export function createHandler(deps: { db: Db; appSecret: string; verifyToken: string; log?: (msg: string, err?: unknown) => void }) {
  const log = deps.log ?? ((msg: string, err?: unknown) => console.error(msg, err ?? ""));

  async function handleMessages(raw: string) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return;
    }
    for (const msg of parseWebhook(body)) {
      const found = await findNumber(deps.db, msg.phoneNumberId);
      if (!found || found.number.status === "desligado") continue;
      const { organizationId } = found;
      const { conversationId, duplicate } = await recordIncoming(deps.db, organizationId, msg);
      if (duplicate) continue;
      const config = await getConfig(deps.db, organizationId);
      if (!config.enabled) continue;
      await scheduleReply(deps.db, organizationId, conversationId, config.debounceSeconds);
    }
  }

  return (req: Req, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    void (async () => {
      try {
        if (url.pathname === "/health" && req.method === "GET") {
          await deps.db.execute(sql`select 1`);
          return send(res, 200, JSON.stringify({ ok: true }), "application/json");
        }
        if (url.pathname !== "/webhook") return send(res, 404, "não encontrado");
        if (req.method === "GET") {
          const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === deps.verifyToken && deps.verifyToken !== "";
          return ok ? send(res, 200, url.searchParams.get("hub.challenge") ?? "") : send(res, 403, "token inválido");
        }
        if (req.method !== "POST") return send(res, 405, "método não permitido");
        let raw: string;
        try {
          raw = await readBody(req);
        } catch (e) {
          if (e instanceof TooLarge) return send(res, 413, "corpo grande demais");
          throw e;
        }
        if (!verifySignature(raw, (req.headers["x-hub-signature-256"] as string | undefined) ?? null, deps.appSecret)) {
          return send(res, 401, "assinatura inválida");
        }
        await handleMessages(raw);
        return send(res, 200, "ok");
      } catch (e) {
        log("Erro no webhook:", e);
        // 500 faz a Meta reenviar; mensagens já gravadas não duplicam (wamid único).
        return send(res, 500, "erro");
      }
    })();
  };
}
