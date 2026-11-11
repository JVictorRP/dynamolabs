/**
 * Banco compartilhado da Dynamo (CRM e bot).
 * Regra de ouro: toda tabela de dados de cliente tem `organization_id` e toda consulta filtra por ele.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

export function createDb(url: string, opts: { ssl?: false | "require"; max?: number } = {}): Db {
  const client = postgres(url, { max: opts.max ?? 10, ssl: opts.ssl ?? false, onnotice: () => {} });
  return drizzle(client, { schema });
}

export { schema };
export { ensureStages } from "./stages";
