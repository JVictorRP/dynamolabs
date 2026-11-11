import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { ContentError, MAX_CAPTION } from "./types";
import { daysLeft, visiblePostCondition } from "./visibility";

export type Post = typeof schema.contentPost.$inferSelect;
export type Media = typeof schema.contentMedia.$inferSelect;
export type PostWithMedia = Post & { media: Media[] };
export type ClientPost = PostWithMedia & { daysLeft: number | null };
export type Format = "feed" | "carrossel" | "reels";
/** Só o que o código precisa do armazenamento para apagar (ContentStorage satisfaz). */
export type FileRemover = { remove(organizationId: string, key: string): Promise<void> };

function checkText(input: { title?: string | null; caption?: string | null }) {
  if (input.caption && input.caption.length > MAX_CAPTION) throw new ContentError("A legenda passa de 2.200 caracteres, o limite do Instagram.");
  if (input.title && input.title.length > 120) throw new ContentError("O título interno passa de 120 caracteres.");
}

async function findPost(db: Db, organizationId: string, postId: string): Promise<Post> {
  const [p] = await db
    .select()
    .from(schema.contentPost)
    .where(and(eq(schema.contentPost.id, postId), eq(schema.contentPost.organizationId, organizationId)));
  if (!p) throw new ContentError("Post não encontrado.");
  return p;
}

const log = (db: Db, organizationId: string, postId: string, type: typeof schema.contentEvent.$inferInsert.type, text?: string) =>
  db.insert(schema.contentEvent).values({ organizationId, postId, type, text: text ?? null });

export async function createPost(
  db: Db,
  organizationId: string,
  input: { format: Format; title?: string; caption?: string; scheduledAt?: Date | null },
): Promise<Post> {
  checkText(input);
  const [p] = await db
    .insert(schema.contentPost)
    .values({ organizationId, format: input.format, title: input.title ?? null, caption: input.caption ?? null, scheduledAt: input.scheduledAt ?? null })
    .returning();
  return p;
}

export async function updatePost(
  db: Db,
  organizationId: string,
  postId: string,
  patch: { title?: string | null; caption?: string | null; scheduledAt?: Date | null },
): Promise<Post> {
  checkText(patch);
  const before = await findPost(db, organizationId, postId);
  const values: Partial<typeof schema.contentPost.$inferInsert> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.caption !== undefined) values.caption = patch.caption;
  if (patch.scheduledAt !== undefined) values.scheduledAt = patch.scheduledAt;
  if (Object.keys(values).length === 0) return before;
  const [p] = await db.update(schema.contentPost).set(values).where(eq(schema.contentPost.id, postId)).returning();
  // Editar depois de enviado ou aprovado fica registrado no histórico.
  if (before.status === "em_aprovacao" || before.status === "ajuste_pedido" || before.status === "aprovado") await log(db, organizationId, postId, "editado");
  return p;
}

/** Status que a equipe define. Aprovado e ajuste pedido só vêm da decisão do cliente. */
export async function setStatus(db: Db, organizationId: string, postId: string, status: "em_aprovacao" | "agendado" | "publicado"): Promise<Post> {
  await findPost(db, organizationId, postId);
  const values: Partial<typeof schema.contentPost.$inferInsert> = { status };
  if (status === "em_aprovacao") values.approvedAt = null;
  if (status === "publicado") values.publishedAt = new Date();
  const [p] = await db.update(schema.contentPost).set(values).where(eq(schema.contentPost.id, postId)).returning();
  if (status === "em_aprovacao") await log(db, organizationId, postId, "enviado");
  return p;
}

export async function reopenPost(db: Db, organizationId: string, postId: string): Promise<Post> {
  await findPost(db, organizationId, postId);
  const [p] = await db.update(schema.contentPost).set({ status: "em_aprovacao", approvedAt: null }).where(eq(schema.contentPost.id, postId)).returning();
  await log(db, organizationId, postId, "reaberto");
  return p;
}

export async function archivePost(db: Db, organizationId: string, postId: string): Promise<Post> {
  await findPost(db, organizationId, postId);
  const [p] = await db.update(schema.contentPost).set({ archivedAt: new Date() }).where(eq(schema.contentPost.id, postId)).returning();
  await log(db, organizationId, postId, "arquivado");
  return p;
}

async function withMedia(db: Db, posts: Post[]): Promise<PostWithMedia[]> {
  if (posts.length === 0) return [];
  const media = await db
    .select()
    .from(schema.contentMedia)
    .where(inArray(schema.contentMedia.postId, posts.map((p) => p.id)))
    .orderBy(asc(schema.contentMedia.position));
  return posts.map((p) => ({ ...p, media: media.filter((m) => m.postId === p.id) }));
}

const GRID_ORDER = [desc(schema.contentPost.scheduledAt), desc(schema.contentPost.createdAt)];

export async function listPostsForStaff(db: Db, organizationId: string, opts: { archived: boolean }): Promise<PostWithMedia[]> {
  const posts = await db
    .select()
    .from(schema.contentPost)
    .where(and(eq(schema.contentPost.organizationId, organizationId), opts.archived ? isNotNull(schema.contentPost.archivedAt) : isNull(schema.contentPost.archivedAt)))
    .orderBy(...GRID_ORDER)
    .limit(200);
  return withMedia(db, posts);
}

/** O que o link do cliente mostra: só posts visíveis (regra de 72 h), na ordem da grade. */
export async function listPostsForClient(db: Db, organizationId: string, now: Date): Promise<ClientPost[]> {
  const posts = await db
    .select()
    .from(schema.contentPost)
    .where(and(eq(schema.contentPost.organizationId, organizationId), visiblePostCondition(now)))
    .orderBy(...GRID_ORDER)
    .limit(60);
  return (await withMedia(db, posts)).map((p) => ({ ...p, daysLeft: daysLeft(p.approvedAt, now) }));
}

/** Apaga o post, as mídias e os arquivos do disco. Os arquivos saem depois das linhas: uma falha ao remover não desfaz. */
export async function deletePost(db: Db, storage: FileRemover, organizationId: string, postId: string): Promise<void> {
  await findPost(db, organizationId, postId);
  const media = await db.select({ fileKey: schema.contentMedia.fileKey }).from(schema.contentMedia).where(eq(schema.contentMedia.postId, postId));
  await db.delete(schema.contentPost).where(and(eq(schema.contentPost.id, postId), eq(schema.contentPost.organizationId, organizationId)));
  for (const m of media) {
    try {
      await storage.remove(organizationId, m.fileKey);
    } catch (e) {
      console.error(`Não foi possível apagar o arquivo ${m.fileKey}:`, e);
    }
  }
}
