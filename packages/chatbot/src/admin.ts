/** Ações internas da Dynamo (tela /admin, protegida pelo ADMIN_TOKEN). */
import { and, count, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { encrypt } from "./crypto";

export class AdminError extends Error {}

async function orgBySlug(db: Db, slug: string) {
  const [org] = await db.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.slug, slug.trim().toLowerCase()));
  if (!org) throw new AdminError(`Nenhuma empresa com o slug "${slug}".`);
  return org.id;
}

/** Liga (ou religa, com token novo) o número de WhatsApp de uma empresa. Uma empresa tem um número. */
export async function linkNumber(
  db: Db,
  input: { organizationSlug: string; phoneNumberId: string; wabaId: string; displayPhone: string; accessToken: string },
  encKey: string,
): Promise<{ organizationId: string }> {
  const organizationId = await orgBySlug(db, input.organizationSlug);
  const phoneNumberId = input.phoneNumberId.trim();
  const accessToken = input.accessToken.trim();
  if (!phoneNumberId || !input.wabaId.trim() || !accessToken) throw new AdminError("Preencha o ID do número, o ID da conta e o token.");

  const [existing] = await db.select().from(schema.whatsappNumber).where(eq(schema.whatsappNumber.phoneNumberId, phoneNumberId));
  if (existing && existing.organizationId !== organizationId) throw new AdminError("Este número já está ligado a outra empresa.");
  const [current] = await db.select().from(schema.whatsappNumber).where(eq(schema.whatsappNumber.organizationId, organizationId));
  if (current && current.phoneNumberId !== phoneNumberId) {
    throw new AdminError(`Esta empresa já tem o número ${current.displayPhone}. Desligue-o antes de ligar outro.`);
  }

  const values = {
    wabaId: input.wabaId.trim(),
    displayPhone: input.displayPhone.trim() || phoneNumberId,
    accessTokenEnc: encrypt(accessToken, encKey),
    status: "ativo" as const,
  };
  if (existing) {
    await db.update(schema.whatsappNumber).set(values).where(eq(schema.whatsappNumber.id, existing.id));
  } else {
    await db.insert(schema.whatsappNumber).values({ ...values, organizationId, phoneNumberId });
  }
  return { organizationId };
}

export async function setNumberStatus(db: Db, phoneNumberId: string, status: "ativo" | "com_problema" | "desligado") {
  await db.update(schema.whatsappNumber).set({ status }).where(eq(schema.whatsappNumber.phoneNumberId, phoneNumberId.trim()));
}

/** Exclusão a pedido do titular: apaga as conversas (e mensagens) desse telefone na empresa. O lead do CRM continua. */
export async function deleteContactData(db: Db, organizationSlug: string, phone: string): Promise<{ conversations: number; messages: number }> {
  const organizationId = await orgBySlug(db, organizationSlug);
  const waId = phone.replace(/\D/g, "");
  if (waId.length < 8) throw new AdminError("Informe o telefone com DDI e DDD.");
  const convs = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(and(eq(schema.conversation.organizationId, organizationId), eq(schema.conversation.waId, waId)));
  if (convs.length === 0) return { conversations: 0, messages: 0 };
  const ids = convs.map((c) => c.id);
  const [m] = await db.select({ n: count() }).from(schema.message).where(inArray(schema.message.conversationId, ids));
  await db.delete(schema.conversation).where(inArray(schema.conversation.id, ids));
  return { conversations: ids.length, messages: Number(m.n) };
}
