// Aplica as migrações do banco ao iniciar o container (idempotente).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  onnotice: () => {},
  // Mesmo critério do app: SSL só se DATABASE_SSL=true
  ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
});
await migrate(drizzle(client), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
await client.end();
console.log("Migrações aplicadas.");
