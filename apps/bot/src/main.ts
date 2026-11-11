/** Serviço do chatbot (bot.dynamo.business): webhook da Meta + worker da fila + tarefas periódicas. */
import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_GRAPH_VERSION, DEFAULT_USD_BRL, anthropicCreateMessage, createGoogleSheetFetcher, createWhatsAppClient } from "@dynamo/chatbot";
import { createDb } from "@dynamo/db";
import { createHandler } from "./http";
import { startPeriodic } from "./periodic";
import { startWorker } from "./worker";

const REQUIRED = ["DATABASE_URL", "ANTHROPIC_API_KEY", "META_APP_SECRET", "META_VERIFY_TOKEN", "CHATBOT_ENC_KEY"] as const;
const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(`Faltam variáveis de ambiente: ${missing.join(", ")}. Veja deploy/bot/README.md.`);
  process.exit(1);
}
const env = (k: string) => process.env[k]!.trim();

const db = createDb(env("DATABASE_URL"), { ssl: process.env.DATABASE_SSL === "true" ? "require" : false, max: 10 });
const googleJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
const deps = {
  db,
  createMessage: anthropicCreateMessage(new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), maxRetries: 2 })),
  whatsapp: createWhatsAppClient({ graphVersion: process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION }),
  fetchSheet: googleJson
    ? createGoogleSheetFetcher(googleJson)
    : async () => {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada no bot.");
      },
  usdBrl: Number(process.env.USD_BRL_RATE) || DEFAULT_USD_BRL,
  encKey: env("CHATBOT_ENC_KEY"),
  now: () => new Date(),
  fetch,
};

const port = Number(process.env.PORT) || 3001;
const server = createServer(createHandler({ db, appSecret: env("META_APP_SECRET"), verifyToken: env("META_VERIFY_TOKEN") }));
server.listen(port, () => console.log(`Bot ouvindo na porta ${port}.`));
const worker = startWorker(deps);
const periodic = startPeriodic(db);

async function shutdown() {
  console.log("Encerrando: terminando os jobs em andamento...");
  periodic.stop();
  server.close();
  await worker.stop();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
