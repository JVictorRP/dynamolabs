import "server-only";
import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import { db, schema } from "../db";

export type IncomingMetric = {
  platform: "meta" | "google";
  campaignId: string;
  campaignName: string;
  day: string; // AAAA-MM-DD
  impressions?: number;
  reach?: number | null;
  clicks?: number;
  spend?: number;
  leads?: number;
  conversions?: number;
};

/** Upsert diário: o n8n pode reenviar o mesmo dia quantas vezes quiser. */
export async function upsertMetrics(organizationId: string, rows: IncomingMetric[]) {
  if (rows.length === 0) return { upserted: 0 };
  await db
    .insert(schema.campaignMetricDaily)
    .values(
      rows.map((r) => ({
        organizationId,
        platform: r.platform,
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        day: r.day,
        impressions: r.impressions ?? 0,
        reach: r.reach ?? null,
        clicks: r.clicks ?? 0,
        spend: String(r.spend ?? 0),
        leads: r.leads ?? 0,
        conversions: r.conversions ?? 0,
      })),
    )
    .onConflictDoUpdate({
      target: [
        schema.campaignMetricDaily.organizationId,
        schema.campaignMetricDaily.platform,
        schema.campaignMetricDaily.campaignId,
        schema.campaignMetricDaily.day,
      ],
      set: {
        campaignName: sql`excluded.campaign_name`,
        impressions: sql`excluded.impressions`,
        reach: sql`excluded.reach`,
        clicks: sql`excluded.clicks`,
        spend: sql`excluded.spend`,
        leads: sql`excluded.leads`,
        conversions: sql`excluded.conversions`,
        updatedAt: new Date(),
      },
    });
  return { upserted: rows.length };
}

/** Totais por campanha no período, para a tela de relatórios. */
export async function campaignTotals(organizationId: string, sinceDay: string) {
  const m = schema.campaignMetricDaily;
  return db
    .select({
      platform: m.platform,
      campaignId: m.campaignId,
      campaignName: sql<string>`max(${m.campaignName})`,
      impressions: sum(m.impressions).mapWith(Number),
      clicks: sum(m.clicks).mapWith(Number),
      spend: sum(m.spend).mapWith(Number),
      leads: sum(m.leads).mapWith(Number),
      conversions: sum(m.conversions).mapWith(Number),
    })
    .from(m)
    .where(and(eq(m.organizationId, organizationId), gte(m.day, sinceDay)))
    .groupBy(m.platform, m.campaignId)
    .orderBy(desc(sum(m.spend)));
}
