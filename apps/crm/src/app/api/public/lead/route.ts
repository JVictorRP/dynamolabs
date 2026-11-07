import { createPublicLeadHandler } from "@dynamo/public-lead";
import { ingestLeads } from "@/lib/data/leads";

/**
 * POST /api/public/lead
 * Formulário de contato do site (dynamo.business). Sem chave de API: a proteção é CORS por origem,
 * campo-isca, limite de envios por IP e validação (ver packages/public-lead).
 * Variáveis: PUBLIC_LEAD_ORGANIZATION_ID, PUBLIC_LEAD_ALLOWED_ORIGINS (origens separadas por vírgula).
 */
const handle = createPublicLeadHandler({
  ingest: ingestLeads,
  now: () => Date.now(),
  allowedOrigins: (process.env.PUBLIC_LEAD_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  organizationId: process.env.PUBLIC_LEAD_ORGANIZATION_ID ?? "",
});

export const POST = handle;
export const OPTIONS = handle;
