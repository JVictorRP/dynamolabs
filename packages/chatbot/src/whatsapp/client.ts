/** Cliente mínimo da Graph API da Meta para a WhatsApp Cloud API (sem intermediários). */
export class WhatsAppAuthError extends Error {}
export class WhatsAppTemporaryError extends Error {}
export class WhatsAppRequestError extends Error {}

export type NumberCredentials = { phoneNumberId: string; accessToken: string };

const MAX_BODY = 4096;

/** Divide um texto em pedaços de até `max` caracteres, preferindo quebrar em parágrafo, linha ou espaço. */
export function splitText(text: string, max = MAX_BODY): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    if (cut < max / 2) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function createWhatsAppClient(opts: { graphVersion: string; fetch?: typeof fetch }) {
  const doFetch = opts.fetch ?? fetch;

  async function post(n: NumberCredentials, body: unknown): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await doFetch(`https://graph.facebook.com/${opts.graphVersion}/${n.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${n.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new WhatsAppTemporaryError(`Falha de rede ao falar com a Meta: ${(e as Error).message}`);
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return json;
    const err = (json.error ?? {}) as { code?: number; message?: string };
    const msg = `Meta respondeu ${res.status}: ${err.message ?? "sem detalhes"}`;
    if (res.status === 401 || res.status === 403 || err.code === 190) throw new WhatsAppAuthError(msg);
    if (res.status === 429 || res.status >= 500) throw new WhatsAppTemporaryError(msg);
    throw new WhatsAppRequestError(msg);
  }

  return {
    async sendText(n: NumberCredentials, to: string, body: string): Promise<{ wamid: string }> {
      let wamid = "";
      for (const part of splitText(body)) {
        const json = await post(n, { messaging_product: "whatsapp", to, type: "text", text: { body: part } });
        wamid = String((json.messages as { id?: string }[] | undefined)?.[0]?.id ?? wamid);
      }
      return { wamid };
    },
    async markRead(n: NumberCredentials, wamid: string): Promise<void> {
      await post(n, { messaging_product: "whatsapp", status: "read", message_id: wamid });
    },
  };
}

export type WhatsAppClient = ReturnType<typeof createWhatsAppClient>;
