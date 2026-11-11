import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { isVisibleToClient } from "./visibility";
import { ContentError, MAX_COMMENT, type ContentEventInfo } from "./types";

export type Decision = "aprovar" | "ajuste";
export type DecideResult = "ok" | "ja_decidido" | "indisponivel";

/**
 * Decisão do cliente (pelo link ou pelo painel). Só vale para posts que o cliente está vendo.
 * Aprovar de novo devolve "ja_decidido" sem gravar nada; duas chamadas ao mesmo tempo gravam um só evento.
 */
export async function decide(
  db: Db,
  deps: { now: () => Date; onEvent?: (e: ContentEventInfo) => void },
  input: { organizationId: string; postId: string; decision: Decision; comment?: string },
): Promise<DecideResult> {
  const { organizationId, postId, decision } = input;
  const comment = (input.comment ?? "").trim();
  if (decision === "ajuste") {
    if (!comment) throw new ContentError("Escreva o que precisa mudar.");
    if (comment.length > MAX_COMMENT) throw new ContentError("O comentário passa de 1.000 caracteres.");
  }
  const now = deps.now();
  const [post] = await db
    .select()
    .from(schema.contentPost)
    .where(and(eq(schema.contentPost.id, postId), eq(schema.contentPost.organizationId, organizationId)));
  if (!post || !isVisibleToClient(post, now)) return "indisponivel";

  const decidable = ["em_aprovacao", "ajuste_pedido"];
  const info = await db.transaction(async (tx) => {
    const [changed] = await tx
      .update(schema.contentPost)
      .set(decision === "aprovar" ? { status: "aprovado", approvedAt: now, clientFeedback: null } : { status: "ajuste_pedido", approvedAt: null, clientFeedback: comment })
      .where(and(eq(schema.contentPost.id, postId), eq(schema.contentPost.organizationId, organizationId), inArray(schema.contentPost.status, decidable as ["em_aprovacao"])))
      .returning({ id: schema.contentPost.id });
    if (!changed) return null;
    const type = decision === "aprovar" ? "aprovado" : "ajuste_pedido";
    const [event] = await tx
      .insert(schema.contentEvent)
      .values({ organizationId, postId, type, text: decision === "ajuste" ? comment : null, createdAt: now })
      .returning({ id: schema.contentEvent.id });
    await tx.insert(schema.contentNotice).values({ organizationId, eventId: event.id, createdAt: now });
    return { type } as const;
  });
  if (!info) return "ja_decidido";

  if (deps.onEvent) {
    const [org] = await db.select({ name: schema.organization.name }).from(schema.organization).where(eq(schema.organization.id, organizationId));
    try {
      deps.onEvent({ organizationId, organizationName: org?.name ?? "", postId, postTitle: post.title, type: info.type, text: decision === "ajuste" ? comment : null, at: now });
    } catch (e) {
      console.error("Erro ao avisar sobre a decisão:", e); // o aviso nunca desfaz a decisão do cliente
    }
  }
  return "ok";
}

export type PendingAction = {
  id: string;
  organizationId: string;
  organizationName: string;
  postId: string;
  postTitle: string | null;
  type: "aprovado" | "ajuste_pedido";
  text: string | null;
  createdAt: Date;
};

/** Fila "precisa de ação": aprovações e pedidos de ajuste ainda não tratados pela equipe. */
export async function listPendingActions(db: Db, organizationId: string | null): Promise<PendingAction[]> {
  const rows = await db
    .select({
      id: schema.contentEvent.id,
      organizationId: schema.contentEvent.organizationId,
      organizationName: schema.organization.name,
      postId: schema.contentEvent.postId,
      postTitle: schema.contentPost.title,
      type: schema.contentEvent.type,
      text: schema.contentEvent.text,
      createdAt: schema.contentEvent.createdAt,
    })
    .from(schema.contentEvent)
    .innerJoin(schema.contentPost, eq(schema.contentPost.id, schema.contentEvent.postId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.contentEvent.organizationId))
    .where(
      and(
        isNull(schema.contentEvent.handledAt),
        inArray(schema.contentEvent.type, ["aprovado", "ajuste_pedido"]),
        organizationId ? eq(schema.contentEvent.organizationId, organizationId) : undefined,
      ),
    )
    .orderBy(schema.contentEvent.createdAt);
  return rows as PendingAction[];
}

export async function markHandled(db: Db, organizationId: string, eventId: string): Promise<void> {
  const done = await db
    .update(schema.contentEvent)
    .set({ handledAt: new Date() })
    .where(and(eq(schema.contentEvent.id, eventId), eq(schema.contentEvent.organizationId, organizationId)))
    .returning({ id: schema.contentEvent.id });
  if (done.length === 0) throw new ContentError("Aviso não encontrado.");
}

/** Quantas ações pendentes cada empresa tem (indicador da lista de Clientes). */
export async function countPendingActions(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ organizationId: schema.contentEvent.organizationId, n: sql<number>`count(*)::int` })
    .from(schema.contentEvent)
    .where(and(isNull(schema.contentEvent.handledAt), inArray(schema.contentEvent.type, ["aprovado", "ajuste_pedido"])))
    .groupBy(schema.contentEvent.organizationId);
  return Object.fromEntries(rows.map((r) => [r.organizationId, Number(r.n)]));
}
