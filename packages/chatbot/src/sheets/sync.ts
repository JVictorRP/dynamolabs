import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import type { SheetFetcher } from "./fetcher";

/** Copia a aba para o banco. Em erro, mantém a cópia anterior e grava o motivo. */
export async function syncSheet(db: Db, organizationId: string, sourceId: string, fetcher: SheetFetcher): Promise<{ rows: number }> {
  const [source] = await db
    .select()
    .from(schema.sheetSource)
    .where(and(eq(schema.sheetSource.id, sourceId), eq(schema.sheetSource.organizationId, organizationId)));
  if (!source) throw new Error("Planilha não encontrada nesta empresa.");

  let matrix: string[][];
  try {
    matrix = await fetcher(source.spreadsheetId, source.tab);
  } catch (e) {
    await db.update(schema.sheetSource).set({ lastError: String((e as Error).message).slice(0, 500) }).where(eq(schema.sheetSource.id, sourceId));
    throw e;
  }

  const [header = [], ...body] = matrix;
  const keys = header.map((h, i) => h.trim() || `Coluna ${i + 1}`);
  const rows = body
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r, i) => ({
      organizationId,
      sourceId,
      position: i,
      data: Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? "").trim()])),
    }));

  await db.transaction(async (tx) => {
    await tx.delete(schema.sheetRow).where(eq(schema.sheetRow.sourceId, sourceId));
    for (let i = 0; i < rows.length; i += 500) await tx.insert(schema.sheetRow).values(rows.slice(i, i + 500));
    await tx.update(schema.sheetSource).set({ lastSyncedAt: new Date(), lastError: null }).where(eq(schema.sheetSource.id, sourceId));
  });
  return { rows: rows.length };
}
