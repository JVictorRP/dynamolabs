import { eq } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "@dynamo/db";
import { MODELS } from "./pricing";

export type BotConfig = typeof schema.botConfig.$inferSelect;

const digits = (v: string) => v.replace(/\D/g, "");

export const botConfigInput = z
  .object({
    enabled: z.boolean(),
    model: z.enum(MODELS as [string, ...string[]]),
    styleGuide: z.string().max(8000),
    styleGuideDraft: z.string().max(8000).nullable(),
    extraRules: z.string().max(4000),
    actions: z.object({
      registrar_lead: z.boolean(),
      passar_humano: z.boolean(),
      avisar_responsavel: z.boolean(),
      enviar_n8n: z.boolean(),
    }),
    n8nWebhookUrl: z
      .string()
      .trim()
      .transform((v) => v || null)
      .refine((v) => v === null || /^https:\/\/[^\s]+$/.test(v), "A URL do n8n precisa começar com https://")
      .nullable(),
    ownerPhone: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[\d\s()+-]+$/.test(v), "Telefone do responsável inválido: use só números, com DDI e DDD.")
      .transform((v) => (v ? digits(v) : null))
      .refine((v) => v === null || (v.length >= 10 && v.length <= 15), "Telefone do responsável inválido: use DDI + DDD + número.")
      .nullable(),
    nonTextPolicy: z.enum(["pedir_texto", "humano"]),
    handoffHours: z.number().int().min(1).max(168),
    monthlyCapBrl: z.number().min(0).max(100_000),
    retentionMonths: z.number().int().min(1).max(60),
    debounceSeconds: z.number().int().min(0).max(30),
  })
  .partial();

export type BotConfigInput = z.input<typeof botConfigInput>;

export async function getConfig(db: Db, organizationId: string): Promise<BotConfig> {
  const [found] = await db.select().from(schema.botConfig).where(eq(schema.botConfig.organizationId, organizationId));
  if (found) return found;
  await db.insert(schema.botConfig).values({ organizationId }).onConflictDoNothing();
  const [created] = await db.select().from(schema.botConfig).where(eq(schema.botConfig.organizationId, organizationId));
  return created;
}

export async function updateConfig(db: Db, organizationId: string, patch: BotConfigInput): Promise<BotConfig> {
  const parsed = botConfigInput.safeParse(patch);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const current = await getConfig(db, organizationId);
  const { monthlyCapBrl, ...rest } = parsed.data;
  const values = { ...rest, ...(monthlyCapBrl !== undefined ? { monthlyCapBrl: monthlyCapBrl.toFixed(2) } : {}) };
  if (Object.keys(values).length === 0) return current;
  const [updated] = await db
    .update(schema.botConfig)
    .set(values)
    .where(eq(schema.botConfig.organizationId, organizationId))
    .returning();
  return updated;
}
