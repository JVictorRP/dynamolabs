/** Regra pura de visibilidade do link do cliente (sem banco). Também é usada no navegador. */

/** Depois de aprovado, o post fica no link do cliente por 3 dias. */
export const HIDE_AFTER_MS = 72 * 3600_000;
const DAY_MS = 24 * 3600_000;

type PostState = { status: string; approvedAt: Date | null; archivedAt: Date | null };

export function isVisibleToClient(post: PostState, now: Date): boolean {
  if (post.archivedAt) return false;
  if (post.status === "em_aprovacao" || post.status === "ajuste_pedido") return true;
  if (post.status === "aprovado" || post.status === "agendado" || post.status === "publicado") {
    return post.approvedAt !== null && now.getTime() - post.approvedAt.getTime() < HIDE_AFTER_MS;
  }
  return false; // rascunho
}

/** Dias inteiros que faltam da janela de 3 dias (nunca negativo); null se ainda não foi aprovado. */
export function daysLeft(approvedAt: Date | null, now: Date): number | null {
  if (!approvedAt) return null;
  const remaining = approvedAt.getTime() + HIDE_AFTER_MS - now.getTime();
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}
