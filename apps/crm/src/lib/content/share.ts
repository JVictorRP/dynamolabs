import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";

const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
const newToken = () => randomBytes(18).toString("base64url"); // 24 caracteres

export async function getActiveShare(db: Db, organizationId: string): Promise<{ token: string } | null> {
  const [s] = await db
    .select({ token: schema.contentShare.token })
    .from(schema.contentShare)
    .where(and(eq(schema.contentShare.organizationId, organizationId), isNull(schema.contentShare.revokedAt)));
  return s ?? null;
}

/** O link da empresa; cria se ainda não existir. */
export async function ensureShare(db: Db, organizationId: string): Promise<{ token: string }> {
  const existing = await getActiveShare(db, organizationId);
  if (existing) return existing;
  try {
    const [s] = await db.insert(schema.contentShare).values({ organizationId, token: newToken() }).returning({ token: schema.contentShare.token });
    return s;
  } catch (e) {
    const raced = await getActiveShare(db, organizationId); // duas telas criando ao mesmo tempo
    if (raced) return raced;
    throw e;
  }
}

/** Revoga o link ativo e cria outro, de uma vez. O antigo deixa de funcionar na hora. */
export async function regenerateShare(db: Db, organizationId: string): Promise<{ token: string }> {
  return db.transaction(async (tx) => {
    await tx
      .update(schema.contentShare)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.contentShare.organizationId, organizationId), isNull(schema.contentShare.revokedAt)));
    const [s] = await tx.insert(schema.contentShare).values({ organizationId, token: newToken() }).returning({ token: schema.contentShare.token });
    return s;
  });
}

/** Empresa dona de um código ativo; null para código desconhecido, malformado ou revogado. */
export async function resolveShare(db: Db, token: string): Promise<{ organizationId: string } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const [s] = await db
    .select({ organizationId: schema.contentShare.organizationId })
    .from(schema.contentShare)
    .where(and(eq(schema.contentShare.token, token), isNull(schema.contentShare.revokedAt)));
  return s ?? null;
}
