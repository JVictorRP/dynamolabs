import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "./db";

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** Cria uma chave para o n8n enviar dados de uma empresa. Mostrada uma única vez. */
export async function createApiKey(organizationId: string, name: string) {
  const key = `dyn_${randomBytes(24).toString("base64url")}`;
  await db.insert(schema.apiKey).values({
    organizationId,
    name,
    prefix: key.slice(0, 10),
    keyHash: hash(key),
  });
  return key;
}

/** Valida o header `Authorization: Bearer dyn_...` e devolve a empresa dona da chave. */
export async function authenticateApiKey(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith("dyn_")) return null;

  const [row] = await db
    .select({ id: schema.apiKey.id, organizationId: schema.apiKey.organizationId })
    .from(schema.apiKey)
    .where(and(eq(schema.apiKey.keyHash, hash(key)), isNull(schema.apiKey.revokedAt)))
    .limit(1);
  if (!row) return null;

  await db.update(schema.apiKey).set({ lastUsedAt: new Date() }).where(eq(schema.apiKey.id, row.id));
  return row.organizationId;
}
