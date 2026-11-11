import { and, eq, max } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { FileError, saveUpload } from "./files";
import { ContentError } from "./types";
import type { Media } from "./posts";
import type { ContentStorage } from "./storage";

const MAX_CAROUSEL = 10;

type Upload = { body: ReadableStream<Uint8Array> | null; contentLength: number | null };

/**
 * Anexa um arquivo a um post, respeitando o formato: post único (1 imagem), carrossel (até 10 imagens),
 * Reels (1 vídeo e 1 capa). O arquivo é gravado primeiro; se a regra recusar, ele é apagado do disco.
 */
export async function attachMedia(
  db: Db,
  storage: ContentStorage,
  organizationId: string,
  postId: string,
  input: Upload & { isCover?: boolean; alt?: string },
): Promise<Media> {
  const [post] = await db
    .select()
    .from(schema.contentPost)
    .where(and(eq(schema.contentPost.id, postId), eq(schema.contentPost.organizationId, organizationId)));
  if (!post) throw new ContentError("Post não encontrado.");
  if (post.format === "stories") throw new FileError("regra", "Stories não são tratados nesta versão.");

  const saved = await saveUpload(storage, { organizationId, body: input.body, contentLength: input.contentLength });
  try {
    const existing = await db.select().from(schema.contentMedia).where(eq(schema.contentMedia.postId, postId));
    const isCover = input.isCover === true;
    const reject = (msg: string): never => {
      throw new FileError("regra", msg);
    };
    if (post.format === "feed") {
      if (isCover) reject("A capa só existe em Reels.");
      if (saved.kind !== "image") reject("Post único aceita só uma imagem. Para vídeo, use Reels.");
      if (existing.length >= 1) reject("Este post já tem a imagem. Remova a atual para trocar.");
    } else if (post.format === "carrossel") {
      if (isCover) reject("A capa só existe em Reels.");
      if (saved.kind !== "image") reject("Carrossel aceita só imagens.");
      if (existing.length >= MAX_CAROUSEL) reject("O carrossel aceita até 10 imagens.");
    } else {
      if (isCover) {
        if (saved.kind !== "image") reject("A capa do Reels precisa ser uma imagem.");
        if (existing.some((m) => m.isCover)) reject("Este Reels já tem capa. Remova a atual para trocar.");
      } else {
        if (saved.kind !== "video") reject("Reels precisa de um vídeo MP4. Envie a imagem como capa.");
        if (existing.some((m) => m.kind === "video")) reject("Este Reels já tem o vídeo. Remova o atual para trocar.");
      }
    }
    const [{ top }] = await db.select({ top: max(schema.contentMedia.position) }).from(schema.contentMedia).where(eq(schema.contentMedia.postId, postId));
    const [row] = await db
      .insert(schema.contentMedia)
      .values({
        organizationId,
        postId,
        kind: saved.kind,
        position: top === null ? 0 : top + 1,
        fileKey: saved.key,
        mime: saved.mime,
        bytes: saved.bytes,
        isCover,
        alt: input.alt?.slice(0, 300) ?? null,
      })
      .returning();
    return row;
  } catch (e) {
    await storage.remove(organizationId, saved.key).catch(() => {});
    throw e;
  }
}

/** Troca a foto do perfil (só imagem) e apaga o arquivo anterior do disco. */
export async function setAvatar(db: Db, storage: ContentStorage, organizationId: string, input: Upload): Promise<{ key: string }> {
  const saved = await saveUpload(storage, { organizationId, body: input.body, contentLength: input.contentLength });
  if (saved.kind !== "image") {
    await storage.remove(organizationId, saved.key).catch(() => {});
    throw new FileError("tipo", "A foto do perfil precisa ser uma imagem (JPG, PNG ou WebP).");
  }
  const [previous] = await db.select().from(schema.contentProfile).where(eq(schema.contentProfile.organizationId, organizationId));
  await db
    .insert(schema.contentProfile)
    .values({ organizationId, avatarFileKey: saved.key })
    .onConflictDoUpdate({ target: schema.contentProfile.organizationId, set: { avatarFileKey: saved.key } });
  if (previous?.avatarFileKey) await storage.remove(organizationId, previous.avatarFileKey).catch(() => {});
  return { key: saved.key };
}

/** Empresa dona de um arquivo (de um post ou foto de perfil); null se nenhuma. */
export async function findFileOwner(db: Db, key: string): Promise<string | null> {
  const [m] = await db.select({ o: schema.contentMedia.organizationId }).from(schema.contentMedia).where(eq(schema.contentMedia.fileKey, key));
  if (m) return m.o;
  const [p] = await db.select({ o: schema.contentProfile.organizationId }).from(schema.contentProfile).where(eq(schema.contentProfile.avatarFileKey, key));
  return p?.o ?? null;
}
