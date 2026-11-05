/**
 * Cadastra um cliente novo no CRM: empresa + usuário de acesso + chave de API para o n8n.
 *
 * Uso:
 *   pnpm novo-cliente --empresa "Bacalhau Club" --nome "Fulano" --email fulano@x.com --senha "SenhaForte123"
 *   (acrescente --demo para preencher com dados de exemplo)
 */
import { createHash, randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { auth } from "../src/lib/auth";
import { db, schema } from "../src/lib/db";

const { values: a } = parseArgs({
  options: {
    empresa: { type: "string" },
    nome: { type: "string" },
    email: { type: "string" },
    senha: { type: "string" },
    papel: { type: "string", default: "owner" },
    demo: { type: "boolean", default: false },
  },
});

if (!a.empresa || !a.nome || !a.email || !a.senha) {
  console.error('Faltam dados. Ex.: --empresa "Cliente" --nome "Nome" --email a@b.com --senha "minimo10caracteres"');
  process.exit(1);
}

const slug = a.empresa
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

async function main() {
  const ctx = await auth.$context;

  // 1) Usuário (reaproveita se o e-mail já existir)
  const found = await ctx.internalAdapter.findUserByEmail(a.email!.toLowerCase());
  let userId = found?.user.id;
  if (!userId) {
    const user = await ctx.internalAdapter.createUser({ name: a.nome!, email: a.email!.toLowerCase(), emailVerified: true },
      { method: "admin" },
    );
    userId = user.id;
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: await ctx.password.hash(a.senha!),
    });
  }

  // 2) Empresa + vínculo
  const [org] = await db
    .insert(schema.organization)
    .values({ id: crypto.randomUUID(), name: a.empresa!, slug, createdAt: new Date() })
    .returning();
  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    userId,
    role: a.papel!,
    createdAt: new Date(),
  });

  // 3) Etapas do funil
  const stages = await db
    .insert(schema.pipelineStage)
    .values(schema.DEFAULT_STAGES.map((s) => ({ ...s, organizationId: org.id })))
    .returning();

  // 4) Chave de API para o n8n
  const key = `dyn_${randomBytes(24).toString("base64url")}`;
  await db.insert(schema.apiKey).values({
    organizationId: org.id,
    name: "n8n",
    prefix: key.slice(0, 10),
    keyHash: createHash("sha256").update(key).digest("hex"),
  });

  if (a.demo) await seedDemo(org.id, stages.map((s) => s.id));

  console.log("\n✅ Cliente criado");
  console.log(`   Empresa: ${org.name} (${org.id})`);
  console.log(`   Login:   ${a.email}`);
  console.log(`   Chave de API do n8n (guarde agora, não aparece de novo):\n   ${key}\n`);
  process.exit(0);
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
