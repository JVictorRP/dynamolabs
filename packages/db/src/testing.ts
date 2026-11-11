/**
 * Banco de teste: Postgres em memória (PGlite) com as migrações reais do CRM aplicadas.
 * Só para testes — nunca importar em código de produção.
 */
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./index";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(new URL("../../../apps/crm/drizzle", import.meta.url));

export async function createTestDb(): Promise<{ db: Db; close(): Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => client.close() };
}

/** Cria uma empresa e devolve o id. */
export async function seedOrg(db: Db, name: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.organization).values({ id, name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${id.slice(0, 6)}`, createdAt: new Date() });
  return id;
}
