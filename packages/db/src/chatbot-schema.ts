/**
 * Tabelas do chatbot de WhatsApp (spec docs/superpowers/specs/2026-11-10-whatsapp-chatbot-design.md, seção 4).
 * Mesma regra de ouro: toda tabela tem `organization_id` e toda consulta filtra por ele.
 */
import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./auth-schema";
import { lead } from "./schema";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const orgId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

/* ───────────── Enums ───────────── */

export const botNumberStatus = pgEnum("bot_number_status", ["ativo", "com_problema", "desligado"]);
export const botNonTextPolicy = pgEnum("bot_non_text_policy", ["pedir_texto", "humano"]);
export const botConversationMode = pgEnum("bot_conversation_mode", ["bot", "humano"]);
export const botMessageDirection = pgEnum("bot_message_direction", ["in", "out"]);
export const botMessageAuthor = pgEnum("bot_message_author", ["cliente", "bot", "humano"]);
export const botJobKind = pgEnum("bot_job_kind", ["responder", "sync_planilha", "gerar_guia"]);
export const botJobStatus = pgEnum("bot_job_status", ["pending", "running", "done", "failed"]);

export type BotActions = {
  registrar_lead: boolean;
  passar_humano: boolean;
  avisar_responsavel: boolean;
  enviar_n8n: boolean;
};

export const DEFAULT_BOT_ACTIONS: BotActions = {
  registrar_lead: true,
  passar_humano: true,
  avisar_responsavel: false,
  enviar_n8n: false,
};

/* ───────────── Número e configuração ───────────── */

export const whatsappNumber = pgTable(
  "whatsapp_number",
  {
    id: id(),
    organizationId: orgId(),
    phoneNumberId: text("phone_number_id").notNull().unique(),
    wabaId: text("waba_id").notNull(),
    displayPhone: text("display_phone").notNull(),
    /** Token da Meta cifrado (AES-256-GCM, chave CHATBOT_ENC_KEY). */
    accessTokenEnc: text("access_token_enc").notNull(),
    status: botNumberStatus("status").notNull().default("ativo"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("whatsapp_number_org_idx").on(t.organizationId)],
);

export const botConfig = pgTable("bot_config", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  model: text("model").notNull().default("claude-haiku-5-5"),
  styleGuide: text("style_guide").notNull().default(""),
  /** Proposta gerada pela IA, aguardando o dono aplicar. */
  styleGuideDraft: text("style_guide_draft"),
  extraRules: text("extra_rules").notNull().default(""),
  actions: jsonb("actions")
    .$type<BotActions>()
    .notNull()
    .default(sql`'{"registrar_lead":true,"passar_humano":true,"avisar_responsavel":false,"enviar_n8n":false}'::jsonb`),
  n8nWebhookUrl: text("n8n_webhook_url"),
  ownerPhone: text("owner_phone"),
  nonTextPolicy: botNonTextPolicy("non_text_policy").notNull().default("pedir_texto"),
  handoffHours: integer("handoff_hours").notNull().default(12),
  monthlyCapBrl: numeric("monthly_cap_brl", { precision: 10, scale: 2 }).notNull().default("300"),
  retentionMonths: integer("retention_months").notNull().default(12),
  debounceSeconds: integer("debounce_seconds").notNull().default(4),
  /** Mês (AAAA-MM) do último aviso de teto atingido — evita avisar mais de uma vez. */
  capNotifiedMonth: text("cap_notified_month"),
  updatedAt: updatedAt(),
});

/* ───────────── Estilo de fala ───────────── */

export const styleUpload = pgTable(
  "style_upload",
  {
    id: id(),
    organizationId: orgId(),
    fileName: text("file_name").notNull(),
    agentName: text("agent_name").notNull(),
    status: text("status").notNull().default("processado"),
    examples: integer("examples").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("style_upload_org_idx").on(t.organizationId, t.createdAt)],
);

export const styleExample = pgTable(
  "style_example",
  {
    id: id(),
    organizationId: orgId(),
    uploadId: text("upload_id").references(() => styleUpload.id, { onDelete: "cascade" }),
    customerText: text("customer_text").notNull(),
    agentText: text("agent_text").notNull(),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('portuguese', coalesce(customer_text, '') || ' ' || coalesce(agent_text, ''))`,
    ),
    createdAt: createdAt(),
  },
  (t) => [
    index("style_example_org_idx").on(t.organizationId),
    index("style_example_search_idx").using("gin", t.search),
  ],
);

/* ───────────── Planilhas ───────────── */

export const sheetSource = pgTable(
  "sheet_source",
  {
    id: id(),
    organizationId: orgId(),
    spreadsheetId: text("spreadsheet_id").notNull(),
    tab: text("tab").notNull(),
    label: text("label").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("sheet_source_org_idx").on(t.organizationId)],
);

export const sheetRow = pgTable(
  "sheet_row",
  {
    id: id(),
    organizationId: orgId(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sheetSource.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL => sql`jsonb_to_tsvector('portuguese'::regconfig, data, '["string", "numeric"]')`,
    ),
  },
  (t) => [
    index("sheet_row_source_idx").on(t.sourceId, t.position),
    index("sheet_row_org_idx").on(t.organizationId),
    index("sheet_row_search_idx").using("gin", t.search),
  ],
);

/* ───────────── Conversas ───────────── */

export const conversation = pgTable(
  "conversation",
  {
    id: id(),
    organizationId: orgId(),
    /** whatsapp | simulador | sistema */
    channel: text("channel").notNull().default("whatsapp"),
    /** Telefone do cliente final (ou identificador do simulador/sistema). */
    waId: text("wa_id").notNull(),
    contactName: text("contact_name"),
    mode: botConversationMode("mode").notNull().default("bot"),
    handoffUntil: timestamp("handoff_until", { withTimezone: true }),
    leadId: text("lead_id").references(() => lead.id, { onDelete: "set null" }),
    lastCustomerAt: timestamp("last_customer_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("conversation_org_channel_wa_uq").on(t.organizationId, t.channel, t.waId),
    index("conversation_org_updated_idx").on(t.organizationId, t.updatedAt),
  ],
);

export const message = pgTable(
  "message",
  {
    id: id(),
    organizationId: orgId(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    direction: botMessageDirection("direction").notNull(),
    author: botMessageAuthor("author").notNull(),
    wamid: text("wamid").unique(),
    type: text("type").notNull().default("text"),
    text: text("text"),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    toolCalls: jsonb("tool_calls").$type<{ name: string; input: unknown; ok: boolean }[]>(),
    /** Mensagens do cliente: quando entraram numa resposta (do bot ou da equipe). Null = ainda sem resposta. */
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("message_conversation_idx").on(t.conversationId, t.createdAt),
    index("message_org_created_idx").on(t.organizationId, t.createdAt),
  ],
);

/* ───────────── Fila ───────────── */

export const botJob = pgTable(
  "bot_job",
  {
    id: id(),
    organizationId: orgId(),
    conversationId: text("conversation_id").references(() => conversation.id, { onDelete: "cascade" }),
    kind: botJobKind("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    runAfter: timestamp("run_after", { withTimezone: true }).defaultNow().notNull(),
    attempts: integer("attempts").notNull().default(0),
    status: botJobStatus("status").notNull().default("pending"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bot_job_pending_responder_uq")
      .on(t.conversationId)
      .where(sql`kind = 'responder' and status = 'pending'`),
    index("bot_job_status_run_idx").on(t.status, t.runAfter),
  ],
);
