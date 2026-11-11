/**
 * Cadastro de cliente: empresa + usuário de acesso + etapas do funil + chave de API do n8n.
 * Usado pelo script `pnpm novo-cliente` e pela rota POST /api/admin/clientes.
 */
import { AccountError, createClientAccount, type NewClientInput as AccountInput } from "./accounts";
import { auth } from "./auth";
import { db, schema } from "./db";

export type NewClientInput = AccountInput;

/** Mantido para o /admin, o script e a API: erro de cadastro com mensagem para a tela. */
export { AccountError as OnboardingError };

/** Cadastra o cliente. Sem `senha`, gera uma (devolvida em `senha`; null se a pessoa já tinha acesso). */
export async function createClient(input: NewClientInput) {
  const r = await createClientAccount({ db, authContext: await auth.$context }, input);
  if (input.demo) await seedDemo(r.organization.id, r.stageIds);
  // A senha só volta quando foi gerada aqui (nunca ecoa a senha que quem chamou informou).
  return { organization: r.organization, login: r.login, senha: input.senha ? undefined : r.senha, apiKey: r.apiKey };
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
        approvedAt: (["aprovado", "agendado", "publicado"] as string[]).includes(statuses[Math.min(i, statuses.length - 1)]) ? today : null,
        title: `Post ${i + 1}`,
        caption: `Legenda de exemplo do post ${i + 1}.`,
        scheduledAt: when,
      };
    }),
  );
}

