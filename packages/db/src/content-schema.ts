/**
 * Conteúdo do Instagram e prévia para o cliente (spec docs/superpowers/specs/2026-11-11-conteudo-previa-design.md).
 * Mesma regra de ouro: toda tabela tem `organization_id` e toda consulta filtra por ele.
 */
import { sql } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization } from "./auth-schema";
import { contentPost } from "./schema";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const orgId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const contentMediaKind = pgEnum("content_media_kind", ["image", "video"]);
export const contentEventType = pgEnum("content_event_type", ["enviado", "aprovado", "ajuste_pedido", "editado", "arquivado", "reaberto"]);

/** Imagem ou vídeo de um post (carrossel: várias imagens; Reels: um vídeo e uma capa). */
export const contentMedia = pgTable(
  "content_media",
  {
    id: id(),
    organizationId: orgId(),
    postId: text("post_id")
      .notNull()
      .references(() => contentPost.id, { onDelete: "cascade" }),
    kind: contentMediaKind("kind").notNull(),
    position: integer("position").notNull(),
    /** Chave do arquivo no armazenamento: <uuid>.<ext>. */
    fileKey: text("file_key").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    isCover: boolean("is_cover").notNull().default(false),
    alt: text("alt"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("content_media_post_position_uq").on(t.postId, t.position),
    index("content_media_org_idx").on(t.organizationId),
    index("content_media_file_idx").on(t.fileKey),
  ],
);

/** Perfil do Instagram do cliente (cabeçalho do celular na prévia). */
export const contentProfile = pgTable("content_profile", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().default(""),
  displayName: text("display_name").notNull().default(""),
  avatarFileKey: text("avatar_file_key"),
  bio: text("bio").notNull().default(""),
  link: text("link").notNull().default(""),
});

/** Link fixo de prévia por cliente. Uma linha ativa por empresa; gerar outro revoga o anterior. */
export const contentShare = pgTable(
  "content_share",
  {
    id: id(),
    organizationId: orgId(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("content_share_active_uq").on(t.organizationId).where(sql`revoked_at is null`)],
);

/** Histórico de cada post. Aprovações e pedidos de ajuste não tratados formam a fila "precisa de ação". */
export const contentEvent = pgTable(
  "content_event",
  {
    id: id(),
    organizationId: orgId(),
    postId: text("post_id")
      .notNull()
      .references(() => contentPost.id, { onDelete: "cascade" }),
    type: contentEventType("type").notNull(),
    text: text("text"),
    createdAt: createdAt(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (t) => [index("content_event_org_idx").on(t.organizationId, t.createdAt), index("content_event_post_idx").on(t.postId)],
);

/** Avisos aguardando o e-mail reunido (um por empresa a cada 10 minutos). */
export const contentNotice = pgTable(
  "content_notice",
  {
    id: id(),
    organizationId: orgId(),
    eventId: text("event_id")
      .notNull()
      .references(() => contentEvent.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("content_notice_pending_idx").on(t.organizationId, t.sentAt)],
);
