import { createHash } from "node:crypto";
import { z } from "zod";

/** Lead no formato que `ingestLeads` do CRM espera (subconjunto usado pelo formulário do site). */
export type IncomingLead = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source: "site";
  externalId?: string | null;
  formName?: string | null;
  fields?: Record<string, unknown>;
};

export type IngestLeads = (organizationId: string, leads: IncomingLead[]) => Promise<{ received: number; inserted: number }>;

export type PublicLeadDeps = {
  /** `ingestLeads` do CRM (apps/crm/src/lib/data/leads.ts). */
  ingest: IngestLeads;
  now: () => number;
  /** Origens do site autorizadas a enviar (ex.: ["https://dynamo.business"]). */
  allowedOrigins: string[];
  /** Organização que recebe os leads do site (a própria Dynamo). */
  organizationId: string;
  /**
   * Quantos proxies de confiança ficam na frente do servidor (padrão 1: o Traefik). O IP do cliente é a entrada de
   * X-Forwarded-For que o ÚLTIMO proxy confiável acrescentou, contando de trás para frente; o que vem antes é
   * controlado por quem envia e não vale como identidade.
   */
  trustedProxyHops?: number;
  /** Teto de endereços acompanhados ao mesmo tempo (padrão 10.000). Passando disso, novos endereços recebem 429. */
  maxTrackedIps?: number;
};

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const DUPLICATE_MS = 10_000;
const MAX_BODY_BYTES = 10_000;
const PRUNE_EVERY_MS = 60_000;

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  /** Campo-isca: invisível para pessoas; robôs costumam preenchê-lo. */
  website: z.string().max(200).optional(),
});

const json = (body: unknown, status: number, headers: Record<string, string> = {}) => Response.json(body, { status, headers });

/**
 * Lê o corpo com teto de bytes. Recusa de cara se o Content-Length já passa do limite e, sem ele, para de ler (e
 * cancela o fluxo) assim que o limite é ultrapassado. Devolve `null` quando o corpo é grande demais.
 */
async function readBody(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * Cria o tratador de `POST /api/public/lead`. O estado de limite de taxa e de duplicidade vive dentro de cada
 * instância (em memória), então reiniciar o servidor o zera — suficiente para barrar abuso simples.
 */
export function createPublicLeadHandler(deps: PublicLeadDeps): (request: Request) => Promise<Response> {
  const hits = new Map<string, number[]>();
  const recent = new Map<string, number>();
  const hops = Math.max(1, deps.trustedProxyHops ?? 1);
  const maxTracked = deps.maxTrackedIps ?? 10_000;
  let lastPrune = 0;

  const clientIp = (request: Request): string => {
    const parts = (request.headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return "unknown";
    return parts[Math.max(0, parts.length - hops)];
  };

  /** Remove o que já expirou. No máximo uma vez por minuto, para não varrer o mapa a cada requisição. */
  const prune = (now: number) => {
    if (now - lastPrune < PRUNE_EVERY_MS) return;
    lastPrune = now;
    for (const [ip, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(ip);
    for (const [key, t] of recent) if (now - t >= DUPLICATE_MS) recent.delete(key);
  };

  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get("origin") ?? "";
    if (!deps.allowedOrigins.includes(origin)) return json({ error: "Origem não autorizada" }, 403);
    const cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "600" },
      });
    }
    if (request.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

    const now = deps.now();
    const ip = clientIp(request);
    if (!hits.has(ip) && hits.size >= maxTracked) {
      prune(now);
      if (!hits.has(ip) && hits.size >= maxTracked) return json({ error: "Muitas tentativas. Tente novamente em instantes." }, 429, { ...cors, "Retry-After": "60" });
    }
    const recentHits = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recentHits.length >= MAX_PER_WINDOW) {
      const retryAfter = Math.ceil((WINDOW_MS - (now - recentHits[0])) / 1000);
      return json({ error: "Muitas tentativas. Tente novamente em instantes." }, 429, { ...cors, "Retry-After": String(retryAfter) });
    }
    recentHits.push(now);
    hits.set(ip, recentHits);
    prune(now);

    const text = await readBody(request, MAX_BODY_BYTES);
    if (text === null) return json({ error: "Mensagem grande demais" }, 413, cors);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return json({ error: "Dados inválidos" }, 400, cors);
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "Dados inválidos" }, 400, cors);
    const { name, email, phone, message, website } = parsed.data;

    // Robô: responde como se tivesse dado certo, sem criar nada.
    if (website && website.trim() !== "") return json({ ok: true }, 200, cors);

    // Duplo clique: mesmo IP, e-mail e mensagem em poucos segundos contam como um só envio.
    const key = `${ip}|${email}|${message ?? ""}`;
    const last = recent.get(key);
    if (last !== undefined && now - last < DUPLICATE_MS) return json({ ok: true }, 200, cors);
    recent.set(key, now);

    // Mesma pessoa, mesmo texto, mesmo dia = o mesmo lead (o CRM deduplica pelo externalId); outro texto = outro lead.
    const day = new Date(now).toISOString().slice(0, 10);
    const externalId = createHash("sha256").update(`${email}|${message ?? ""}|${day}`).digest("hex");
    try {
      await deps.ingest(deps.organizationId, [
        { name, email, phone: phone ?? null, source: "site", externalId, formName: "Site dynamo.business", fields: message ? { message } : {} },
      ]);
    } catch {
      recent.delete(key); // deixa a pessoa tentar de novo
      return json({ error: "Não foi possível enviar agora. Tente novamente em instantes." }, 500, cors);
    }
    return json({ ok: true }, 201, cors);
  };
}
