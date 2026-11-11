/** A mesma regra de `rules.ts`, como condição SQL para as consultas. */
import { and, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { schema } from "@dynamo/db";
import { HIDE_AFTER_MS } from "./rules";

export { HIDE_AFTER_MS, daysLeft, isVisibleToClient } from "./rules";

/** A mesma regra como condição SQL (posts da tabela `content_post`). */
export function visiblePostCondition(now: Date) {
  const cutoff = new Date(now.getTime() - HIDE_AFTER_MS);
  const p = schema.contentPost;
  return and(
    isNull(p.archivedAt),
    or(
      inArray(p.status, ["em_aprovacao", "ajuste_pedido"]),
      and(inArray(p.status, ["aprovado", "agendado", "publicado"]), isNotNull(p.approvedAt), gt(p.approvedAt, cutoff)),
    ),
  );
}
