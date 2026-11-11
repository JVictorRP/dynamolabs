import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "../auth";
import { db, schema } from "../db";
import { isStaff } from "../staff";

/** Sessão atual, ou null. Funciona dentro de rotas de API (sem redirecionar). */
export async function currentSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { userId: session.user.id, email: session.user.email, staff: isStaff(session.user.email) } : null;
}

/** A pessoa é da equipe Dynamo ou membro desta empresa. */
export async function canSeeOrganization(session: { userId: string; staff: boolean }, organizationId: string): Promise<boolean> {
  if (session.staff) return true;
  const [m] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(and(eq(schema.member.userId, session.userId), eq(schema.member.organizationId, organizationId)));
  return Boolean(m);
}
