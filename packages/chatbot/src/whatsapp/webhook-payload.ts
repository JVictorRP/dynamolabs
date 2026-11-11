/** Leitura tolerante do webhook de mensagens da WhatsApp Cloud API. */
export type IncomingMessage = {
  phoneNumberId: string;
  waId: string;
  contactName: string | null;
  wamid: string;
  type: string;
  text: string | null;
  timestamp: Date;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export function parseWebhook(body: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  for (const entry of arr(obj(body)?.entry)) {
    for (const change of arr(obj(entry)?.changes)) {
      const value = obj(obj(change)?.value);
      const phoneNumberId = str(obj(value?.metadata)?.phone_number_id);
      if (!value || !phoneNumberId) continue;
      const names = new Map<string, string>();
      for (const c of arr(value.contacts)) {
        const waId = str(obj(c)?.wa_id);
        const name = str(obj(obj(c)?.profile)?.name);
        if (waId && name) names.set(waId, name);
      }
      for (const raw of arr(value.messages)) {
        const m = obj(raw);
        const waId = str(m?.from);
        const wamid = str(m?.id);
        const type = str(m?.type);
        if (!m || !waId || !wamid || !type) continue;
        const ts = Number(m.timestamp);
        out.push({
          phoneNumberId,
          waId,
          contactName: names.get(waId) ?? null,
          wamid,
          type,
          text: type === "text" ? str(obj(m.text)?.body) : null,
          timestamp: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(),
        });
      }
    }
  }
  return out;
}
