"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { regenerateShare } from "@/lib/content/share";
import { FileError } from "@/lib/content/files";
import { markHandled } from "@/lib/content/decisions";
import { removeMedia, reorderMedia } from "@/lib/content/media";
import { parseSaoPauloLocal } from "@/lib/content/dates";
import { archivePost, createPost, deletePost, reopenPost, setStatus, unarchivePost, updatePost, type Format } from "@/lib/content/posts";
import { saveProfile } from "@/lib/content/profile";
import { getStorage } from "@/lib/content/storage-instance";
import { ContentError } from "@/lib/content/types";
import { db, schema } from "@/lib/db";
import { requireStaff } from "@/lib/staff";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Só a equipe; confere a empresa; devolve a mensagem de erro da regra em vez de quebrar a tela. */
async function run<T extends object>(organizationId: string, fn: () => Promise<T | void>): Promise<Result<T>> {
  await requireStaff();
  const [org] = await db.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.id, organizationId));
  if (!org) return { ok: false, error: "Empresa não encontrada." };
  try {
    const extra = (await fn()) ?? {};
    revalidatePath(`/clientes/${organizationId}/conteudo`);
    return { ok: true, ...(extra as T) };
  } catch (e) {
    if (e instanceof ContentError || e instanceof FileError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Erro inesperado. Veja os logs do serviço no Easypanel." };
  }
}

type PostFields = { title: string; caption: string; scheduledAt: string };

export async function createPostAction(orgId: string, input: PostFields & { format: Format }) {
  return run(orgId, async () => {
    const post = await createPost(db, orgId, {
      format: input.format,
      title: input.title.trim() || undefined,
      caption: input.caption || undefined,
      scheduledAt: parseSaoPauloLocal(input.scheduledAt),
    });
    return { postId: post.id };
  });
}

export async function updatePostAction(orgId: string, postId: string, input: PostFields) {
  return run(orgId, () => updatePost(db, orgId, postId, { title: input.title.trim() || null, caption: input.caption || null, scheduledAt: parseSaoPauloLocal(input.scheduledAt) }));
}

export async function setStatusAction(orgId: string, postId: string, status: "em_aprovacao" | "agendado" | "publicado") {
  return run(orgId, () => setStatus(db, orgId, postId, status));
}
export async function reopenPostAction(orgId: string, postId: string) {
  return run(orgId, () => reopenPost(db, orgId, postId));
}
export async function archivePostAction(orgId: string, postId: string) {
  return run(orgId, () => archivePost(db, orgId, postId));
}
export async function unarchivePostAction(orgId: string, postId: string) {
  return run(orgId, () => unarchivePost(db, orgId, postId));
}
export async function deletePostAction(orgId: string, postId: string) {
  return run(orgId, () => deletePost(db, getStorage(), orgId, postId));
}
export async function removeMediaAction(orgId: string, mediaId: string) {
  return run(orgId, () => removeMedia(db, getStorage(), orgId, mediaId));
}
export async function reorderMediaAction(orgId: string, postId: string, orderedIds: string[]) {
  return run(orgId, () => reorderMedia(db, orgId, postId, orderedIds));
}
export async function saveProfileAction(orgId: string, input: { handle: string; displayName: string; bio: string; link: string }) {
  return run(orgId, () => saveProfile(db, orgId, input));
}
export async function regenerateLinkAction(orgId: string) {
  return run(orgId, async () => ({ token: (await regenerateShare(db, orgId)).token }));
}
export async function markHandledAction(orgId: string, eventId: string) {
  return run(orgId, () => markHandled(db, orgId, eventId));
}
