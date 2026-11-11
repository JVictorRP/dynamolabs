/**
 * Esquema do banco do CRM Dynamo.
 *
 * Regra de ouro (multi-tenant): TODA tabela de dados de cliente tem `organization_id`.
 * Nenhuma consulta pode ler/escrever sem filtrar por ele — use sempre as funções
 * de src/lib/data/*, que recebem a organização já validada pela sessão ou pela chave de API.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
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
import { organization, user } from "./auth-schema";

export * from "./auth-schema";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const orgId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

/* ───────────── Enums ───────────── */

export const leadSource = pgEnum("lead_source", [
  "meta_ads",
  "google_ads",
  "site",
  "whatsapp",
  "instagram",
  "indicacao",
  "manual",
  "outro",
]);

export const adPlatform = pgEnum("ad_platform", ["meta", "google"]);

export const contentFormat = pgEnum("content_format", ["feed", "carrossel", "reels", "stories"]);

export const contentStatus = pgEnum("content_status", [
  "rascunho",
  "em_aprovacao",
  "ajuste_pedido",
  "aprovado",
  "agendado",
  "publicado",
]);

/* ───────────── Funil ───────────── */

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    id: id(),
    organizationId: orgId(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    color: text("color"),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("pipeline_stage_org_idx").on(t.organizationId, t.position)],
);

/** Etapas criadas automaticamente para cada cliente novo. */
export const DEFAULT_STAGES = [
  { name: "Novo lead", position: 0 },
  { name: "Em contato", position: 1 },
  { name: "Qualificado", position: 2 },
  { name: "Proposta", position: 3 },
  { name: "Ganho", position: 4, isWon: true },
  { name: "Perdido", position: 5, isLost: true },
] as const;

/* ───────────── Leads ───────────── */

export const lead = pgTable(
  "lead",
  {
    id: id(),
    organizationId: orgId(),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    source: leadSource("source").notNull().default("manual"),
    /** ID do lead na plataforma de origem (ex.: leadgen_id da Meta) — evita duplicar. */
    externalId: text("external_id"),
    campaignName: text("campaign_name"),
    adsetName: text("adset_name"),
    adName: text("ad_name"),
    formName: text("form_name"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    stageId: text("stage_id").references(() => pipelineStage.id, { onDelete: "set null" }),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    value: numeric("value", { precision: 12, scale: 2 }),
    notes: text("notes"),
    /** Respostas extras do formulário (perguntas personalizadas). */
    fields: jsonb("fields").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [
    index("lead_org_created_idx").on(t.organizationId, t.createdAt),
    index("lead_org_stage_idx").on(t.organizationId, t.stageId),
    uniqueIndex("lead_org_source_external_uq").on(t.organizationId, t.source, t.externalId),
  ],
);

export const leadEvent = pgTable(
  "lead_event",
  {
    id: id(),
    organizationId: orgId(),
    leadId: text("lead_id")
      .notNull()
      .references(() => lead.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "criado" | "mudou_etapa" | "nota"
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("lead_event_lead_idx").on(t.leadId, t.createdAt)],
);

/* ───────────── Relatórios de campanha ───────────── */

export const campaignMetricDaily = pgTable(
  "campaign_metric_daily",
  {
    id: id(),
    organizationId: orgId(),
    platform: adPlatform("platform").notNull(),
    campaignId: text("campaign_id").notNull(),
    campaignName: text("campaign_name").notNull(),
    day: date("day").notNull(),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach"),
    clicks: integer("clicks").notNull().default(0),
    spend: numeric("spend", { precision: 12, scale: 2 }).notNull().default("0"),
    leads: integer("leads").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("campaign_metric_uq").on(t.organizationId, t.platform, t.campaignId, t.day),
    index("campaign_metric_org_day_idx").on(t.organizationId, t.day),
  ],
);

/* ───────────── Conteúdo (grade do Instagram) ───────────── */

export const contentPost = pgTable(
  "content_post",
  {
    id: id(),
    organizationId: orgId(),
    format: contentFormat("format").notNull().default("feed"),
    status: contentStatus("status").notNull().default("rascunho"),
    title: text("title"),
    caption: text("caption"),
    /** Capa exibida na grade (4:5). */
    coverUrl: text("cover_url"),
    mediaUrls: jsonb("media_urls").$type<string[]>().default(sql`'[]'::jsonb`),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    clientFeedback: text("client_feedback"),
    /** Quando o cliente aprovou. Três dias depois o post sai do link dele (a equipe continua com tudo). */
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Arquivado pela equipe: some do link do cliente. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("content_post_org_sched_idx").on(t.organizationId, t.scheduledAt)],
);

/* ───────────── Chaves de API (n8n → CRM) ───────────── */

export const apiKey = pgTable(
  "org_api_key",
  {
    id: id(),
    organizationId: orgId(),
    name: text("name").notNull(),
    /** Primeiros caracteres, só para identificar a chave na tela. */
    prefix: text("prefix").notNull(),
    /** SHA-256 da chave. A chave em si nunca é guardada. */
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("org_api_key_org_idx").on(t.organizationId)],
);

/* ───────────── Relações ───────────── */

export const leadRelations = relations(lead, ({ one, many }) => ({
  stage: one(pipelineStage, { fields: [lead.stageId], references: [pipelineStage.id] }),
  events: many(leadEvent),
}));

export const leadEventRelations = relations(leadEvent, ({ one }) => ({
  lead: one(lead, { fields: [leadEvent.leadId], references: [lead.id] }),
}));

export const pipelineStageRelations = relations(pipelineStage, ({ many }) => ({
  leads: many(lead),
}));
export * from "./chatbot-schema";
export * from "./content-schema";
