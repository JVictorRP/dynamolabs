/**
 * Contas de clientes: empresa, pessoas com acesso e senhas.
 * Sem dependência do Next: recebe o banco e o contexto do Better Auth (testável com banco em memória).
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { ensureStages, schema, type Db } from "@dynamo/db";

/** O que usamos do contexto do Better Auth (contrato mínimo, para testes com banco em memória). */
export type AuthInternals = {
  internalAdapter: {
    findUserByEmail(email: string): Promise<{ user: { id: string } } | null>;
    createUser(user: { name: string; email: string; emailVerified: boolean }, context: { method: string }): Promise<{ id: string }>;
    linkAccount(account: { userId: string; providerId: string; accountId: string; password: string }): Promise<unknown>;
    updatePassword(userId: string, password: string): Promise<unknown>;
    deleteUserSessions(userId: string): Promise<unknown>;
  };
  password: { hash(password: string): Promise<string> };
};
export type AccountDeps = { db: Db; authContext: AuthInternals };
export type Role = "owner" | "admin" | "member";

export class AccountError extends Error {}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Senha de 16 caracteres sem letras ou números que se confundem (0/O, 1/l/I). */
export function generatePassword(length = 16): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Usuário pelo e-mail; cria com senha quando não existe. `senha` volta null se a pessoa já tinha acesso. */
async function ensureUser(deps: AccountDeps, nome: string, email: string, senha?: string): Promise<{ userId: string; senha: string | null }> {
  const ctx = deps.authContext;
  const found = await ctx.internalAdapter.findUserByEmail(email);
  if (found) return { userId: found.user.id, senha: null };
  const password = senha ?? generatePassword();
  if (password.length < 10) throw new AccountError("A senha precisa ter pelo menos 10 caracteres.");
  const user = await ctx.internalAdapter.createUser({ name: nome, email, emailVerified: true }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(password) });
  return { userId: user.id, senha: password };
}

export type NewClientInput = { empresa: string; nome: string; email: string; senha?: string; papel?: Role; demo?: boolean };

/** Empresa + primeiro acesso + etapas do funil + chave do n8n (mostrada uma única vez). */
export async function createClientAccount(deps: AccountDeps, input: NewClientInput) {
  const { db } = deps;
  const empresa = input.empresa.trim();
  const email = input.email.trim().toLowerCase();
  const slug = slugify(empresa);
  if (!slug) throw new AccountError("Nome da empresa inválido.");
  const [taken] = await db.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.slug, slug));
  if (taken) throw new AccountError(`Já existe uma empresa com o nome "${empresa}".`);

  const { userId, senha } = await ensureUser(deps, input.nome.trim(), email, input.senha);
  const [org] = await db.insert(schema.organization).values({ id: crypto.randomUUID(), name: empresa, slug, createdAt: new Date() }).returning();
  await db.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: org.id, userId, role: input.papel ?? "owner", createdAt: new Date() });
  const stages = await ensureStages(db, org.id);

  const apiKey = `dyn_${randomBytes(24).toString("base64url")}`;
  await db.insert(schema.apiKey).values({
    organizationId: org.id,
    name: "n8n",
    prefix: apiKey.slice(0, 10),
    keyHash: createHash("sha256").update(apiKey).digest("hex"),
  });
  return { organization: { id: org.id, name: org.name, slug: org.slug }, login: email, senha, apiKey, stageIds: stages.map((s) => s.id) };
}

/** Dá acesso a mais uma pessoa numa empresa existente. */
export async function addMember(deps: AccountDeps, organizationId: string, input: { nome: string; email: string; papel: Role }) {
  const { db } = deps;
  const email = input.email.trim().toLowerCase();
  const [org] = await db.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.id, organizationId));
  if (!org) throw new AccountError("Empresa não encontrada.");
  const existingUser = await deps.authContext.internalAdapter.findUserByEmail(email);
  if (existingUser) {
    const [already] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, existingUser.user.id)));
    if (already) throw new AccountError(`${email} já tem acesso a esta empresa.`);
  }
  const { userId, senha } = await ensureUser(deps, input.nome.trim(), email);
  await db.insert(schema.member).values({ id: crypto.randomUUID(), organizationId, userId, role: input.papel, createdAt: new Date() });
  return { login: email, senha, existing: senha === null };
}

/** Gera uma senha nova para alguém da empresa e encerra as sessões abertas dessa pessoa. */
export async function resetMemberPassword(deps: AccountDeps, organizationId: string, userId: string): Promise<string> {
  const [m] = await deps.db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, userId)));
  if (!m) throw new AccountError("Esta pessoa não faz parte desta empresa.");
  const senha = generatePassword();
  const ctx = deps.authContext;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(senha));
  await ctx.internalAdapter.deleteUserSessions(userId);
  return senha;
}

export type ClientRow = { id: string; name: string; slug: string; createdAt: Date; members: number; leadsThisMonth: number; whatsappStatus: string | null };

export async function listClients(db: Db, now: Date): Promise<ClientRow[]> {
  const local = new Date(now.getTime() - 3 * 3600_000);
  const monthStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3));
  const orgId = sql.raw(`"organization"."id"`);
  const rows = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      createdAt: schema.organization.createdAt,
      members: sql<number>`(select count(*)::int from member m where m.organization_id = ${orgId})`,
      leadsThisMonth: sql<number>`(select count(*)::int from lead l where l.organization_id = ${orgId} and l.created_at >= ${monthStart.toISOString()}::timestamptz)`,
      whatsappStatus: sql<string | null>`(select w.status::text from whatsapp_number w where w.organization_id = ${orgId} limit 1)`,
    })
    .from(schema.organization)
    .orderBy(schema.organization.name);
  return rows.map((r) => ({ ...r, members: Number(r.members), leadsThisMonth: Number(r.leadsThisMonth) }));
}

export async function getClient(db: Db, organizationId: string) {
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, organizationId));
  if (!org) return null;
  const members = await db
    .select({ userId: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.member.role, since: schema.member.createdAt })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(eq(schema.member.organizationId, organizationId))
    .orderBy(schema.member.createdAt);
  return { ...org, members };
}
