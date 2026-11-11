import "server-only";
import { db } from "../db";
import { flushDigests } from "./digest";
import { createResendSender } from "./resend";
import { checkWritable, findMissingFiles, volumeProblem } from "./storage";
import { contentDir, getStorage } from "./storage-instance";

const KEY = Symbol.for("dynamo.content.background");

/** Inicialização do CRM: confere a pasta de arquivos e liga o envio periódico do e-mail reunido. Roda uma vez por processo. */
export function startContentBackground() {
  const g = globalThis as Record<symbol, boolean>;
  if (g[KEY]) return;
  g[KEY] = true;

  checkWritable(contentDir()).then(
    () => console.log(`Arquivos do conteúdo: ${contentDir()} (gravação ok).`),
    (e) => console.error(`ATENÇÃO — ${(e as Error).message}`),
  );
  void volumeProblem(contentDir(), { production: process.env.NODE_ENV === "production" }).then((msg) => msg && console.error(`ATENÇÃO — ${msg}`));
  findMissingFiles(db, getStorage()).then(
    ({ total, missing }) => missing > 0 && console.error(`ATENÇÃO — ${missing} de ${total} arquivos do conteúdo registrados no banco não existem no disco. O volume /data está montado e é o mesmo de antes?`),
    () => {},
  );

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipients = (process.env.DYNAMO_NOTIFY_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!apiKey || recipients.length === 0) {
    console.log("E-mail de avisos do conteúdo desligado (faltam RESEND_API_KEY e DYNAMO_NOTIFY_EMAILS).");
    return;
  }
  const send = createResendSender({ apiKey, from: process.env.CONTENT_MAIL_FROM?.trim() || "Dynamo <avisos@mail.dynamo.business>" });
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    flushDigests(db, { now: () => new Date(), send, recipients, baseUrl: process.env.BETTER_AUTH_URL ?? "" })
      .catch((e) => console.error("Erro ao enviar os avisos de conteúdo:", e))
      .finally(() => (running = false));
  }, 60_000).unref();
}
