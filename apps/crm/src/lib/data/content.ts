import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";

/** Posts na ordem da grade do Instagram: o mais recente/agendado mais tarde aparece primeiro. */
export async function listGrid(organizationId: string) {
  return db
    .select()
    .from(schema.contentPost)
    .where(eq(schema.contentPost.organizationId, organizationId))
    .orderBy(desc(schema.contentPost.scheduledAt), desc(schema.contentPost.createdAt))
    .limit(60);
}

export async function setPostFeedback(
  organizationId: string,
  postId: string,
  status: "aprovado" | "rascunho",
  feedback: string | null,
) {
  await db
    .update(schema.contentPost)
    .set({ status, clientFeedback: feedback })
    .where(and(eq(schema.contentPost.id, postId), eq(schema.contentPost.organizationId, organizationId)));
}
