import { schema, type Db } from "@dynamo/db";
import { anonymize } from "./anonymize";
import { extractExamples } from "./examples";
import { listAuthors, parseExport } from "./parse-export";

/** Importa uma conversa exportada: grava só exemplos anonimizados; o arquivo original não é guardado. */
export async function importStyleExport(
  db: Db,
  organizationId: string,
  file: { fileName: string; bytes: Uint8Array },
  agent: string,
): Promise<{ uploadId: string; examples: number }> {
  const lines = parseExport(file);
  const authors = listAuthors(lines).map((a) => a.author);
  if (!authors.includes(agent)) throw new Error(`O atendente "${agent}" não aparece nesta conversa.`);
  const others = authors.filter((a) => a !== agent);
  const pairs = extractExamples(lines, agent).map((p) => ({
    customerText: anonymize(p.customerText, others),
    agentText: anonymize(p.agentText, others),
  }));

  return db.transaction(async (tx) => {
    const [upload] = await tx
      .insert(schema.styleUpload)
      .values({ organizationId, fileName: file.fileName.slice(0, 200), agentName: agent, examples: pairs.length })
      .returning({ id: schema.styleUpload.id });
    if (pairs.length > 0) {
      await tx.insert(schema.styleExample).values(pairs.map((p) => ({ ...p, organizationId, uploadId: upload.id })));
    }
    return { uploadId: upload.id, examples: pairs.length };
  });
}
