import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { getConfig } from "../config";
import { getConversationRow, history, type ToolCallRecord, type UsageTotals } from "../conversations";
import { MSG_JA_RESPONDO } from "../env";
import { costUsd, isModelId, type ModelId } from "../pricing";
import { handOff, toolsFor, type ToolContext } from "../tools";
import type { CreateMessage } from "./llm";
import { buildMessages, buildSystem, findExamples } from "./prompt";

export const MAX_TOOL_ROUNDS = 6;

export type Reply = {
  text: string | null;
  handoff: boolean;
  usage: UsageTotals;
  costUsd: number;
  toolCalls: ToolCallRecord[];
};

export type RespondDeps = {
  db: Db;
  createMessage: CreateMessage;
  organizationId: string;
  conversationId: string;
  testMode: boolean;
  notify: ToolContext["notify"];
  fetch: typeof fetch;
};

/** Gera a resposta do bot para a conversa (sem enviar nada ao WhatsApp). */
export async function respond(deps: RespondDeps): Promise<Reply> {
  const { db, organizationId, conversationId } = deps;
  const usage: UsageTotals = { input: 0, cached: 0, cacheWrite: 0, output: 0 };
  const result: Reply = { text: null, handoff: false, usage, costUsd: 0, toolCalls: [] };

  const conv = await getConversationRow(db, organizationId, conversationId);
  if (!conv) throw new Error("Conversa não encontrada nesta empresa.");
  const config = await getConfig(db, organizationId);
  const [org] = await db.select({ name: schema.organization.name }).from(schema.organization).where(eq(schema.organization.id, organizationId));
  const hist = await history(db, organizationId, conversationId, 20);
  if (hist.length === 0 || hist[hist.length - 1].author !== "cliente") return result;

  const lastText = [...hist].reverse().find((m) => m.author === "cliente" && m.text)?.text ?? "";
  const messages = buildMessages(hist, await findExamples(db, organizationId, lastText));
  if (messages.length === 0) return result;

  const model: ModelId = isModelId(config.model) ? config.model : "claude-haiku-5-5";
  const tools = toolsFor(config);
  const byName = new Map(tools.map((t) => [t.name, t]));
  const ctx: ToolContext = {
    db,
    organizationId,
    conversationId,
    waId: conv.waId,
    contactName: conv.contactName,
    config,
    testMode: deps.testMode,
    notify: deps.notify,
    fetch: deps.fetch,
  };
  const system = buildSystem({ name: org?.name ?? "" }, config);

  const giveUp = async (motivo: string) => {
    if (!deps.testMode) await handOff(ctx, motivo);
    result.handoff = true;
    result.text = MSG_JA_RESPONDO;
    return result;
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await deps.createMessage({
      model,
      max_tokens: 16000,
      system,
      tools: tools.map((t) => t.definition),
      messages,
      output_config: { effort: "low" },
    });
    const u = response.usage;
    usage.input += u.input_tokens;
    usage.output += u.output_tokens;
    usage.cached += u.cache_read_input_tokens ?? 0;
    usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    result.costUsd += costUsd(model, u);

    if (response.stop_reason === "refusal") return giveUp("a IA recusou responder esta mensagem");

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      result.text = text || null;
      return result;
    }

    messages.push({ role: "assistant", content: response.content });
    const uses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const results = await Promise.all(
      uses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => {
        const tool = byName.get(use.name);
        try {
          if (!tool) throw new Error(`Ferramenta desconhecida: ${use.name}`);
          return { type: "tool_result", tool_use_id: use.id, content: await tool.run(use.input, ctx) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: use.id, content: (e as Error).message, is_error: true };
        }
      }),
    );
    results.forEach((r, i) => result.toolCalls.push({ name: uses[i].name, input: uses[i].input, ok: !r.is_error }));
    messages.push({ role: "user", content: results });
  }
  return giveUp("a IA não concluiu a resposta");
}
