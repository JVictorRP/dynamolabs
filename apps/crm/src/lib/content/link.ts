/** Rotas públicas do link de prévia. Sem login: a proteção é o código, o limite por IP e a regra de visibilidade. */
import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { neutralNotFound, serveFile } from "./files";
import { decide, type Decision } from "./decisions";
import { resolveShare } from "./share";
import type { ContentStorage } from "./storage";
import { ContentError, type ContentEventInfo } from "./types";
import { visiblePostCondition } from "./visibility";

type Limiter = { hit(ip: string): boolean };

const tooMany = () => new Response(null, { status: 429, headers: { "retry-after": "600", "cache-control": "no-store" } });
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

/** Arquivo pertence a um post que o link mostra agora, ou é a foto do perfil da empresa do código. */
async function belongsToVisiblePost(db: Db, organizationId: string, key: string, now: Date): Promise<boolean> {
  const [media] = await db
    .select({ id: schema.contentMedia.id })
    .from(schema.contentMedia)
    .innerJoin(schema.contentPost, eq(schema.contentPost.id, schema.contentMedia.postId))
    .where(and(eq(schema.contentMedia.fileKey, key), eq(schema.contentMedia.organizationId, organizationId), eq(schema.contentPost.organizationId, organizationId), visiblePostCondition(now)));
  if (media) return true;
  const [avatar] = await db
    .select({ o: schema.contentProfile.organizationId })
    .from(schema.contentProfile)
    .where(and(eq(schema.contentProfile.organizationId, organizationId), eq(schema.contentProfile.avatarFileKey, key)));
  return Boolean(avatar);
}

export async function serveLinkFile(
  deps: { db: Db; storage: ContentStorage; limiter: Limiter; now: () => Date },
  input: { token: string; key: string; ip: string; range: string | null },
): Promise<Response> {
  if (!deps.limiter.hit(input.ip)) return tooMany();
  const share = await resolveShare(deps.db, input.token);
  if (!share) return neutralNotFound();
  if (!(await belongsToVisiblePost(deps.db, share.organizationId, input.key, deps.now()))) return neutralNotFound();
  return serveFile(deps.storage, { organizationId: share.organizationId, key: input.key, range: input.range });
}

function parseDecisionBody(body: unknown): { postId: string; decision: Decision; comment?: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.postId !== "string" || !b.postId || b.postId.length > 100) return null;
  if (b.decision !== "aprovar" && b.decision !== "ajuste") return null;
  if (b.comment !== undefined && typeof b.comment !== "string") return null;
  return { postId: b.postId, decision: b.decision, comment: b.comment };
}

export async function handleLinkDecision(
  deps: { db: Db; limiter: Limiter; now: () => Date; onEvent?: (e: ContentEventInfo) => void },
  input: { token: string; ip: string; body: unknown },
): Promise<Response> {
  if (!deps.limiter.hit(input.ip)) return tooMany();
  const share = await resolveShare(deps.db, input.token);
  if (!share) return neutralNotFound();
  const parsed = parseDecisionBody(input.body);
  if (!parsed) return json({ error: "Pedido inválido." }, 400);
  try {
    const resultado = await decide(deps.db, { now: deps.now, onEvent: deps.onEvent }, { organizationId: share.organizationId, ...parsed });
    return resultado === "indisponivel" ? neutralNotFound() : json({ resultado });
  } catch (e) {
    if (e instanceof ContentError) return json({ error: e.message }, 400);
    throw e;
  }
}
