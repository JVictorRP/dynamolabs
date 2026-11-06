/**
 * Cadastro de cliente: empresa + usuário de acesso + etapas do funil + chave de API do n8n.
 * Usado pelo script `pnpm novo-cliente` e pela rota POST /api/admin/clientes.
 */
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db, schema } from "./db";

export type NewClientInput = {
  empresa: string;
  nome: string;
  email: string;
  senha: string;
  papel?: "owner" | "admin" | "member";
  demo?: boolean;
};

export class OnboardingError extends Error {}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createClient(input: NewClientInput) {
  if (input.senha.length < 10) throw new OnboardingError("A senha precisa ter pelo menos 10 caracteres.");
  const email = input.email.trim().toLowerCase();
  const slug = slugify(input.empresa);

  const [taken] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug));
  if (taken) throw new OnboardingError(`Já existe uma empresa com o nome "${input.empresa}".`);

  const ctx = await auth.$context;

  // 1) Usuário (reaproveita se o e-mail já existir)
  const found = await ctx.internalAdapter.findUserByEmail(email);
  let userId = found?.user.id;
  if (!userId) {
    const user = await ctx.internalAdapter.createUser({ name: input.nome, email, emailVerified: true }, { method: "admin" });
    userId = user.id;
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: await ctx.password.hash(input.senha),
    });
  }

  // 2) Empresa + vínculo
  const [org] = await db
    .insert(schema.organization)
    .values({ id: crypto.randomUUID(), name: input.empresa, slug, createdAt: new Date() })
    .returning();
  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    userId,
    role: input.papel ?? "owner",
    createdAt: new Date(),
  });

  // 3) Etapas do funil
  const stages = await db
    .insert(schema.pipelineStage)
    .values(schema.DEFAULT_STAGES.map((s) => ({ ...s, organizationId: org.id })))
    .returning();

  // 4) Chave de API para o n8n (mostrada uma única vez)
  const apiKey = `dyn_${randomBytes(24).toString("base64url")}`;
  await db.insert(schema.apiKey).values({
    organizationId: org.id,
    name: "n8n",
    prefix: apiKey.slice(0, 10),
    keyHash: createHash("sha256").update(apiKey).digest("hex"),
  });

  if (input.demo) await seedDemo(org.id, stages.map((s) => s.id));

  return { organization: { id: org.id, name: org.name, slug: org.slug }, login: email, apiKey };
}

async function seedDemo(organizationId: string, stageIds: string[]) {
  const sources = ["meta_ads", "meta_ads", "google_ads", "site", "instagram"] as const;
  const names = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Nunes", "Gabi Torres", "Heitor Melo"];
  await db.insert(schema.lead).values(
    names.map((name, i) => ({
      organizationId,
      name,
      phone: `(27) 9${String(80000000 + i * 1371).slice(0, 4)}-${String(1000 + i * 77)}`,
      source: sources[i % sources.length],
      externalId: `demo-${i}`,
      campaignName: i % 2 ? "Leads | Novembro" : "Remarketing | Site",
      stageId: stageIds[i % 4],
    })),
  );

  const today = new Date();
  const metrics = [];
  for (let d = 0; d < 30; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const iso = day.toISOString().slice(0, 10);
    metrics.push(
      { organizationId, platform: "meta" as const, campaignId: "m1", campaignName: "Leads | Novembro", day: iso, impressions: 4200 + d * 13, clicks: 96 + (d % 7), spend: "58.40", leads: 4 + (d % 3) },
      { organizationId, platform: "google" as const, campaignId: "g1", campaignName: "Pesquisa | Marca", day: iso, impressions: 900 + d * 5, clicks: 71 + (d % 5), spend: "41.10", leads: 2 + (d % 2) },
    );
  }
  await db.insert(schema.campaignMetricDaily).values(metrics);

  const statuses = ["em_aprovacao", "em_aprovacao", "aprovado", "agendado", "publicado", "publicado"] as const;
  await db.insert(schema.contentPost).values(
    Array.from({ length: 9 }, (_, i) => {
      const when = new Date(today);
      when.setDate(when.getDate() + 6 - i * 2);
      return {
        organizationId,
        format: (["feed", "carrossel", "reels"] as const)[i % 3],
        status: statuses[Math.min(i, statuses.length - 1)],
        title: `Post ${i + 1}`,
        caption: `Legenda de exemplo do post ${i + 1}.`,
        scheduledAt: when,
      };
    }),
  );
}

