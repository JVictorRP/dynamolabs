import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://dynamo:dynamo@localhost:5432/dynamo";

// Uma única conexão reaproveitada pelo app inteiro.
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
export { schema };
