import type Anthropic from "@anthropic-ai/sdk";
import type { CreateMessage } from "../../src/brain/llm";

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

export function reply(
  content: Block[],
  stop_reason: "end_turn" | "tool_use" | "refusal" = content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
  usage: Partial<Anthropic.Usage> = {},
): Anthropic.Message {
  return {
    id: "msg_" + Math.random().toString(36).slice(2),
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage },
  } as unknown as Anthropic.Message;
}
export const text = (t: string, usage?: Partial<Anthropic.Usage>) => reply([{ type: "text", text: t }], "end_turn", usage);
export const toolUse = (...calls: { id?: string; name: string; input: unknown }[]) =>
  reply(calls.map((c, i) => ({ type: "tool_use" as const, id: c.id ?? `tu_${i}`, name: c.name, input: c.input })));

/** Claude falso: devolve as respostas na ordem e guarda os parâmetros recebidos (cópia profunda). */
export function fakeLlm(script: Anthropic.Message[]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = async (params) => {
    calls.push(structuredClone(params));
    const next = script[Math.min(calls.length - 1, script.length - 1)];
    if (!next) throw new Error("roteiro vazio");
    return next;
  };
  return { create, calls };
}
