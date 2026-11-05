import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-keys";
import { upsertMetrics } from "@/lib/data/campaigns";

/**
 * POST /api/v1/campaign-metrics
 * O n8n puxa os resultados diários do Meta Ads / Google Ads e envia aqui.
 * Corpo: { "metrics": [ { platform, campaignId, campaignName, day: "2026-11-05", impressions, clicks, spend, leads, conversions } ] }
 */
const n = z.coerce.number().nonnegative();

const bodySchema = z.object({
  metrics: z
    .array(
      z.object({
        platform: z.enum(["meta", "google"]),
        campaignId: z.string().min(1).max(100),
        campaignName: z.string().min(1).max(300),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD"),
        impressions: n.int().optional(),
        reach: n.int().nullish(),
        clicks: n.int().optional(),
        spend: n.optional(),
        leads: n.int().optional(),
        conversions: n.int().optional(),
      }),
    )
    .max(2000),
});

export async function POST(request: Request) {
  const organizationId = await authenticateApiKey(request);
  if (!organizationId) {
    return NextResponse.json({ error: "Chave de API inválida" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: z.treeifyError(parsed.error) }, { status: 400 });
  }

  return NextResponse.json(await upsertMetrics(organizationId, parsed.data.metrics));
}
