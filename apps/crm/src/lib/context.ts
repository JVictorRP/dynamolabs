import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db, schema } from "./db";

export type OrgContext = {
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string; slug: string; logo: string | null };
  role: string;
};

/**
 * Camada de acesso: resolve o usuário logado e a empresa (organization) ativa.
 * Toda página do painel e toda server action começa por aqui.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const memberships = await db
    .select({ role: schema.member.role, org: schema.organization })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
    .where(eq(schema.member.userId, session.user.id));

  if (memberships.length === 0) redirect("/sem-acesso");

  const active =
    memberships.find((m) => m.org.id === session.session.activeOrganizationId) ?? memberships[0];

  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    organization: {
      id: active.org.id,
      name: active.org.name,
      slug: active.org.slug,
      logo: active.org.logo ?? null,
    },
    role: active.role,
  };
});

export async function listUserOrganizations(userId: string) {
  return db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
    .where(and(eq(schema.member.userId, userId)));
}
