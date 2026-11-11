import { createDb } from "@dynamo/db";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://dynamo:dynamo@localhost:5432/dynamo";

// SSL desligado por padrão: o Postgres do Easypanel fica na rede interna do servidor.
// Para um banco externo que exija SSL, defina DATABASE_SSL=true.
export const dbSsl = process.env.DATABASE_SSL === "true" ? ("require" as const) : false;

// Uma única conexão reaproveitada pelo app inteiro.
export const db = createDb(connectionString, { ssl: dbSsl, max: 10 });
export { schema };
