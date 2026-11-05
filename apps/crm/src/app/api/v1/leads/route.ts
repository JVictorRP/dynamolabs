import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-keys";
import { ingestLeads } from "@/lib/data/leads";
import { schema } from "@/lib/db";

/**
 * POST /api/v1/leads
 * Usado pelo n8n para enviar leads de Meta Ads, Google Ads, formulários do site etc.
 * Header: Authorization: Bearer dyn_xxx  (chave da empresa cliente)
 * Corpo: um lead ou { "leads": [ ... ] } (até 500 por chamada)
 */
const optionalText = z.string().trim().max(500).nullish();

const leadSchema = z.object({
  name: optionalText,
  email: z.string().trim().toLowerCase().max(320).nullish(),
  phone: z.string().trim().max(40).nullish(),
  source: z.enum(schema.leadSource.enumValues).default("outro"),
  externalId: z.string().trim().max(200).nullish(),
  campaignName: optionalText,
  adsetName: optionalText,
  adName: optionalText,
  formName: optionalText,
  utmSource: optionalText,
  utmMedium: optionalText,
  utmCampaign: optionalText,
  fields: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date().optional(),
});

const bodySchema = z.union([
  z.object({ leads: z.array(leadSchema).min(1).max(500) }),
  leadSchema.transform((lead) => ({ leads: [lead] })),
]);

export async function POST(request: Request) {
  const organizationId = await authenticateApiKey(request);
  if (!organizationId) {
    return NextResponse.json({ error: "Chave de API inválida" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const result = await ingestLeads(organizationId, parsed.data.leads);
  return NextResponse.json(result, { status: 201 });
}

