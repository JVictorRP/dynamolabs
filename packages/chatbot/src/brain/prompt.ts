import type Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import type { BotConfig } from "../config";
import type { Message } from "../conversations";
import type { ExamplePair } from "../style/examples";

/** Instruções fixas da Dynamo para todo bot. Sem datas nem ids: fazem parte do prefixo em cache. */
export const BASE_INSTRUCTIONS = `Você é o assistente virtual de uma empresa no WhatsApp e conversa com clientes dela.

Regras:
- Na primeira resposta de cada conversa, apresente-se como assistente virtual da empresa.
- Fale só sobre o negócio da empresa. Para outros assuntos, diga com educação que só pode ajudar com assuntos da empresa.
- Preço, estoque, cardápio, horário, endereço, prazos e qualquer dado do negócio só podem vir da ferramenta buscar_planilha. Nunca invente nem estime. Se a busca não trouxer a informação, diga que vai confirmar com a equipe e chame passar_humano (quando ela estiver disponível).
- Nunca invente políticas, promoções, descontos ou garantias.
- Se a pessoa pedir para falar com uma pessoa, reclamar ou quiser negociar, chame passar_humano.
- Quando a pessoa demonstrar interesse real (orçamento, reserva, compra, visita), registre com registrar_lead (quando disponível).
- Escreva como no WhatsApp: mensagens curtas, sem markdown, sem listas longas, no tom do guia de estilo da empresa.
- Os exemplos de conversas anteriores mostram o jeito de escrever do atendente; imite o tom, não copie dados deles.`;

export function buildSystem(org: { name: string }, config: Pick<BotConfig, "styleGuide" | "extraRules">): Anthropic.TextBlockParam[] {
  const company = [
    `Empresa: ${org.name}`,
    config.styleGuide.trim() ? `Guia de estilo de fala:\n${config.styleGuide.trim()}` : "Guia de estilo de fala: simpático, direto e educado.",
    config.extraRules.trim() ? `Regras extras da empresa:\n${config.extraRules.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { type: "text", text: BASE_INSTRUCTIONS },
    { type: "text", text: company, cache_control: { type: "ephemeral" } },
  ];
}

const describe = (m: Pick<Message, "text" | "type">) => m.text ?? `[enviou ${m.type === "audio" ? "um áudio" : m.type === "image" ? "uma imagem" : "uma mídia"}]`;

export function buildMessages(hist: Pick<Message, "author" | "text" | "type">[], examples: ExamplePair[]): Anthropic.MessageParam[] {
  const firstCustomer = hist.findIndex((m) => m.author === "cliente");
  if (firstCustomer < 0) return [];
  const msgs: Anthropic.MessageParam[] = hist.slice(firstCustomer).map((m) => ({
    role: m.author === "cliente" ? "user" : "assistant",
    content: describe(m),
  }));
  // Junta mensagens seguidas do mesmo lado (a API aceita, mas fica mais claro para o modelo).
  const merged: Anthropic.MessageParam[] = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n${m.content}`;
    else merged.push({ ...m });
  }
  const last = merged[merged.length - 1];
  if (examples.length > 0 && last?.role === "user") {
    const block = examples.map((e) => `Cliente: ${e.customerText}\nAtendente: ${e.agentText}`).join("\n---\n");
    last.content = [
      { type: "text", text: `Exemplos de como o atendente responde situações parecidas:\n${block}` },
      { type: "text", text: String(last.content) },
    ];
  }
  return merged;
}

/** Exemplos de estilo parecidos com a mensagem; sem nenhum parecido, os mais recentes. */
export async function findExamples(db: Db, organizationId: string, text: string, limit = 8): Promise<ExamplePair[]> {
  const select = { customerText: schema.styleExample.customerText, agentText: schema.styleExample.agentText };
  const tsq = sql`nullif(replace(plainto_tsquery('portuguese', ${text.slice(0, 300)})::text, '&', '|'), '')::tsquery`;
  const similar = text.trim()
    ? await db
        .select(select)
        .from(schema.styleExample)
        .where(and(eq(schema.styleExample.organizationId, organizationId), sql`${schema.styleExample.search} @@ ${tsq}`))
        .orderBy(desc(sql`ts_rank(${schema.styleExample.search}, ${tsq})`))
        .limit(limit)
    : [];
  if (similar.length > 0) return similar;
  return db
    .select(select)
    .from(schema.styleExample)
    .where(eq(schema.styleExample.organizationId, organizationId))
    .orderBy(desc(schema.styleExample.createdAt))
    .limit(limit);
}
