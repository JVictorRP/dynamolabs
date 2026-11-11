import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@dynamo/db";
import { searchSheets } from "../sheets/search";
import { defineTool } from "./types";

export const buscarPlanilha = defineTool({
  name: "buscar_planilha",
  description:
    "Busca nas planilhas da empresa (preços, produtos, estoque, horários, endereços, regras). Use SEMPRE antes de informar qualquer dado do negócio. Devolve até 10 linhas.",
  properties: {
    consulta: { type: "string", description: "Palavras para buscar, por exemplo 'bacalhau preço' ou 'horário sábado'." },
    planilha: { type: ["string", "null"], description: "Nome da planilha para limitar a busca, ou null para buscar em todas." },
  },
  input: z.object({ consulta: z.string().trim().min(1).max(200), planilha: z.string().nullable() }),
  async run({ consulta, planilha }, ctx) {
    let sourceId: string | undefined;
    if (planilha) {
      const [s] = await ctx.db
        .select({ id: schema.sheetSource.id })
        .from(schema.sheetSource)
        .where(and(eq(schema.sheetSource.organizationId, ctx.organizationId), ilike(schema.sheetSource.label, planilha)));
      sourceId = s?.id;
    }
    const hits = await searchSheets(ctx.db, ctx.organizationId, consulta, { sourceId });
    if (hits.length === 0) return "Nada encontrado nas planilhas para essa busca.";
    return hits
      .map((h) => `[${h.planilha}] ` + Object.entries(h.dados).filter(([, v]) => v !== "").map(([k, v]) => `${k}: ${v}`).join(" | "))
      .join("\n");
  },
});
