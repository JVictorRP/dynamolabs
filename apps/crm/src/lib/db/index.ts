import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://dynamo:dynamo@localhost:5432/dynamo";

// SSL desligado por padrão: o Postgres do Easypanel fica na rede interna do servidor.
// Para um banco externo que exija SSL, defina DATABASE_SSL=true.
export const dbSsl = process.env.DATABASE_SSL === "true" ? ("require" as const) : false;

// Uma única conexão reaproveitada pelo app inteiro.
const client = postgres(connectionString, { max: 10, ssl: dbSsl });

export const db = drizzle(client, { schema });
export { schema };
