/**
 * E-mail reunido para a equipe: um por empresa, quando o aviso pendente mais antigo tem 10 minutos ou mais.
 * Os avisos ficam no banco (sobrevivem a reinício) e só são marcados como enviados depois do envio dar certo.
 * Pensado para uma instância do CRM: com duas, um aviso poderia sair duas vezes.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";

export const DIGEST_AFTER_MS = 10 * 60_000;

type Send = (to: string[], subject: string, text: string) => Promise<void>;
type Item = { noticeId: string; type: "aprovado" | "ajuste_pedido"; title: string; text: string | null };

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 300);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function compose(orgName: string, orgId: string, items: Item[], baseUrl: string) {
  const approved = items.filter((i) => i.type === "aprovado");
  const adjust = items.filter((i) => i.type === "ajuste_pedido");
  const parts = [approved.length && plural(approved.length, "aprovado", "aprovados"), adjust.length && plural(adjust.length, "pedido de ajuste", "pedidos de ajuste")].filter(Boolean);
  const lines = [orgName, ""];
  if (approved.length) lines.push(`Aprovados (${approved.length}):`, ...approved.map((i) => `- ${oneLine(i.title)}`), "");
  if (adjust.length) lines.push(`Pedidos de ajuste (${adjust.length}):`, ...adjust.map((i) => `- ${oneLine(i.title)}: "${oneLine(i.text ?? "")}"`), "");
  lines.push(`Abrir o conteúdo: ${baseUrl.replace(/\/$/, "")}/clientes/${orgId}/conteudo`);
  return { subject: `Dynamo: ${orgName} — ${parts.join(", ")}`, text: lines.join("\n") };
}

export async function flushDigests(
  db: Db,
  deps: { now: () => Date; send: Send; recipients: string[]; baseUrl: string },
): Promise<{ sent: number }> {
  if (deps.recipients.length === 0) return { sent: 0 };
  const now = deps.now();
  const rows = await db
    .select({
      noticeId: schema.contentNotice.id,
      createdAt: schema.contentNotice.createdAt,
      organizationId: schema.contentNotice.organizationId,
      organizationName: schema.organization.name,
      type: schema.contentEvent.type,
      text: schema.contentEvent.text,
      title: schema.contentPost.title,
    })
    .from(schema.contentNotice)
    .innerJoin(schema.contentEvent, eq(schema.contentEvent.id, schema.contentNotice.eventId))
    .innerJoin(schema.contentPost, eq(schema.contentPost.id, schema.contentEvent.postId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.contentNotice.organizationId))
    .where(and(isNull(schema.contentNotice.sentAt)))
    .orderBy(asc(schema.contentNotice.createdAt));

  const byOrg = new Map<string, typeof rows>();
  for (const r of rows) byOrg.set(r.organizationId, [...(byOrg.get(r.organizationId) ?? []), r]);

  let sent = 0;
  for (const [orgId, group] of byOrg) {
    if (now.getTime() - group[0].createdAt.getTime() < DIGEST_AFTER_MS) continue;
    const items: Item[] = group.map((g) => ({ noticeId: g.noticeId, type: g.type as Item["type"], title: g.title ?? "post sem título", text: g.text }));
    const { subject, text } = compose(group[0].organizationName, orgId, items, deps.baseUrl);
    try {
      await deps.send(deps.recipients, subject, text);
    } catch (e) {
      console.error(`E-mail de conteúdo de "${group[0].organizationName}" não saiu; os avisos continuam pendentes:`, (e as Error).message);
      continue;
    }
    await db.update(schema.contentNotice).set({ sentAt: now }).where(inArray(schema.contentNotice.id, items.map((i) => i.noticeId)));
    sent += 1;
  }
  return { sent };
}
