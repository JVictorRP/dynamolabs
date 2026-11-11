import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";

export type SheetHit = { planilha: string; dados: Record<string, string> };

/**
 * Busca linhas das planilhas da empresa, em três tentativas: todas as palavras (busca de texto),
 * todas as palavras como trecho, e por fim qualquer palavra ordenada por relevância.
 */
export async function searchSheets(
  db: Db,
  organizationId: string,
  query: string,
  opts: { sourceId?: string; limit?: number } = {},
): Promise<SheetHit[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 10);
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const scope: SQL[] = [eq(schema.sheetRow.organizationId, organizationId)];
  if (opts.sourceId) scope.push(eq(schema.sheetRow.sourceId, opts.sourceId));

  const select = { planilha: schema.sheetSource.label, dados: schema.sheetRow.data };
  const base = () =>
    db.select(select).from(schema.sheetRow).innerJoin(schema.sheetSource, eq(schema.sheetSource.id, schema.sheetRow.sourceId));
  const fullText = (tsq: SQL) =>
    base()
      .where(and(...scope, sql`${schema.sheetRow.search} @@ ${tsq}`))
      .orderBy(desc(sql`ts_rank(${schema.sheetRow.search}, ${tsq})`), schema.sheetRow.position)
      .limit(limit);

  // 1) todas as palavras (busca de texto, com plural e flexões)
  const all = await fullText(sql`plainto_tsquery('portuguese', ${q})`);
  if (all.length > 0) return all;

  // 2) todas as palavras como trecho (preços, códigos, nomes próprios)
  const words = q.split(/\s+/).filter(Boolean).slice(0, 8);
  const escapeLike = (w: string) => w.replace(/[\\%_]/g, (c) => "\\" + c);
  const partial = await base()
    .where(and(...scope, ...words.map((w) => ilike(sql`${schema.sheetRow.data}::text`, `%${escapeLike(w)}%`))))
    .orderBy(schema.sheetRow.position)
    .limit(limit);
  if (partial.length > 0) return partial;

  // 3) qualquer palavra, mais relevantes primeiro (perguntas naturais: "quanto custa o bacalhau?")
  return fullText(sql`nullif(replace(plainto_tsquery('portuguese', ${q})::text, '&', '|'), '')::tsquery`);
}
