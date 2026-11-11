import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { Db } from "@dynamo/db";
import type { BotConfig } from "../config";

export type ToolContext = {
  db: Db;
  organizationId: string;
  conversationId: string;
  waId: string;
  contactName: string | null;
  config: BotConfig;
  /** Simulador: ferramentas com efeito só descrevem o que fariam. */
  testMode: boolean;
  notify: (to: string, text: string) => Promise<void>;
  fetch: typeof fetch;
  /** Chave estável por job + ação: o n8n pode usar para ignorar repetições. */
  idempotencyKey?: string;
};

export type BotTool = {
  name: string;
  definition: Anthropic.Tool;
  run(input: unknown, ctx: ToolContext): Promise<string>;
};

export class ToolInputError extends Error {}

type Prop = { type: "string" | ["string", "null"]; description: string };

/** Monta uma ferramenta com esquema estrito (todas as propriedades obrigatórias; opcionais aceitam null). */
export function defineTool<S extends z.ZodTypeAny>(spec: {
  name: string;
  description: string;
  properties: Record<string, Prop>;
  input: S;
  run: (input: z.output<S>, ctx: ToolContext) => Promise<string>;
}): BotTool {
  return {
    name: spec.name,
    definition: {
      name: spec.name,
      description: spec.description,
      strict: true,
      input_schema: {
        type: "object",
        properties: spec.properties,
        required: Object.keys(spec.properties),
        additionalProperties: false,
      },
    },
    async run(input, ctx) {
      const parsed = spec.input.safeParse(input);
      if (!parsed.success) throw new ToolInputError(`Entrada inválida para ${spec.name}: ${parsed.error.issues[0].message}`);
      return spec.run(parsed.data, ctx);
    },
  };
}
