import type Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { ensureConversation, recordOutgoing } from "../conversations";
import { costUsd } from "../pricing";
import type { CreateMessage } from "./llm";

const MODEL = "claude-sonnet-5-5" as const;
const SAMPLE = 60;

/** Gera uma proposta de guia de estilo a partir dos exemplos reais da empresa. */
export async function generateStyleGuide(deps: { db: Db; createMessage: CreateMessage; organizationId: string }): Promise<string> {
  const { db, organizationId } = deps;
  const examples = await db
    .select({ customerText: schema.styleExample.customerText, agentText: schema.styleExample.agentText })
    .from(schema.styleExample)
    .where(eq(schema.styleExample.organizationId, organizationId))
    .orderBy(desc(schema.styleExample.createdAt))
    .limit(SAMPLE);
  if (examples.length === 0) throw new Error("Suba pelo menos uma conversa exportada antes de gerar o guia.");

  const sample = examples.map((e, i) => `#${i + 1}\nCliente: ${e.customerText}\nAtendente: ${e.agentText}`).join("\n\n");
  const response = await deps.createMessage({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    system:
      "Você analisa conversas reais de WhatsApp de um atendente de uma empresa e escreve um guia de estilo de fala para um assistente virtual imitar esse atendente.",
    messages: [
      {
        role: "user",
        content: `Abaixo estão trechos reais (dados pessoais trocados por marcadores como [CLIENTE]).\n\n${sample}\n\nEscreva o guia em português, em tópicos curtos: tom e formalidade, tamanho das mensagens, uso de emojis, expressões típicas, como cumprimenta, como responde dúvidas, como conduz para a venda ou reserva, como se despede e o que evita. Não inclua dados do negócio (preços, horários) nem os marcadores. Responda só com o guia.`,
      },
    ],
  });
  const guide = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const conv = await ensureConversation(db, organizationId, "sistema", "guia-de-estilo", "Guia de estilo");
  const u = response.usage;
  await recordOutgoing(db, organizationId, conv.id, {
    author: "bot",
    text: guide.slice(0, 2000),
    usage: { input: u.input_tokens, cached: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, output: u.output_tokens },
    costUsd: costUsd(MODEL, u),
  });
  if (!guide) throw new Error("A IA não devolveu um guia. Tente de novo.");
  return guide;
}
