import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { campaignTotals } from "@/lib/data/campaigns";
import { parsePeriod, periodStart, toDay } from "@/lib/data/period";
import { fmtBRL, fmtInt, fmtPct, safeDiv } from "@/lib/format";
import { EmptyState, PageHeader, PeriodTabs, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Campanhas" };

const PLATFORM = { meta: "Meta Ads", google: "Google Ads" } as const;

export default async function CampanhasPage({ searchParams }: PageProps<"/campanhas">) {
  const { organization } = await getOrgContext();
  const period = parsePeriod((await searchParams).periodo);
  const rows = await campaignTotals(organization.id, toDay(periodStart(period)));

  const t = rows.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      leads: a.leads + r.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 },
  );

  return (
    <>
      <PageHeader eyebrow="Relatórios" title="Campanhas">
        <PeriodTabs current={period} basePath="/campanhas" />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Investimento" value={fmtBRL(t.spend)} accent />
        <Stat label="Impressões" value={fmtInt(t.impressions)} />
        <Stat label="CTR" value={fmtPct(safeDiv(t.clicks, t.impressions))} hint={`${fmtInt(t.clicks)} cliques`} />
        <Stat label="Custo por lead" value={fmtBRL(safeDiv(t.spend, t.leads))} hint={`${fmtInt(t.leads)} leads`} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Sem dados de campanha" text="Os resultados de Meta Ads e Google Ads são atualizados todos os dias pela Dynamo." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink-900 text-left text-xs text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Campanha</th>
                <th className="px-4 py-3 text-right font-medium">Investimento</th>
                <th className="px-4 py-3 text-right font-medium">Impressões</th>
                <th className="px-4 py-3 text-right font-medium">Cliques</th>
                <th className="px-4 py-3 text-right font-medium">CTR</th>
                <th className="px-4 py-3 text-right font-medium">Leads</th>
                <th className="px-4 py-3 text-right font-medium">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {rows.map((r) => (
                <tr key={`${r.platform}-${r.campaignId}`} className="tabular-nums">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.campaignName}</p>
                    <p className="text-xs text-ink-500">{PLATFORM[r.platform]}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{fmtBRL(r.spend)}</td>
                  <td className="px-4 py-3 text-right">{fmtInt(r.impressions)}</td>
                  <td className="px-4 py-3 text-right">{fmtInt(r.clicks)}</td>
                  <td className="px-4 py-3 text-right">{fmtPct(safeDiv(r.clicks, r.impressions))}</td>
                  <td className="px-4 py-3 text-right">{fmtInt(r.leads)}</td>
                  <td className="px-4 py-3 text-right">{fmtBRL(safeDiv(r.spend, r.leads))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
