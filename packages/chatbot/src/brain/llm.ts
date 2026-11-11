import type Anthropic from "@anthropic-ai/sdk";

/** Uma chamada ao Claude. Injetável: os testes usam uma versão falsa. */
export type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

export function anthropicCreateMessage(client: Anthropic): CreateMessage {
  return (params) => client.messages.create(params);
}
