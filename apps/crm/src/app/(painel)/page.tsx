import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { ensureStages, leadSummary } from "@/lib/data/leads";
import { campaignTotals } from "@/lib/data/campaigns";
import { parsePeriod, periodStart, toDay } from "@/lib/data/period";
import { fmtBRL, fmtInt, safeDiv, SOURCE_LABEL } from "@/lib/format";
import { Card, PageHeader, PeriodTabs, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Visão geral" };

export default async function VisaoGeral({ searchParams }: PageProps<"/">) {
  const { organization } = await getOrgContext();
  const period = parsePeriod((await searchParams).periodo);
  const since = periodStart(period);

  const [summary, campaigns, stages] = await Promise.all([
    leadSummary(organization.id, since),
    campaignTotals(organization.id, toDay(since)),
    ensureStages(organization.id),
  ]);

  const spend = campaigns.reduce((a, c) => a + c.spend, 0);
  const adLeads = campaigns.reduce((a, c) => a + c.leads, 0);
  const stageCount = new Map(summary.byStage.map((s) => [s.stageId, Number(s.total)]));
  const maxStage = Math.max(1, ...stages.map((s) => stageCount.get(s.id) ?? 0));

  return (
    <>
      <PageHeader eyebrow="Visão geral" title={`Olá, ${organization.name}`}>
        <PeriodTabs current={period} basePath="/" />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads no período" value={fmtInt(summary.total)} accent />
        <Stat label="Investimento" value={fmtBRL(spend)} hint="Meta + Google" />
        <Stat label="Custo por lead" value={fmtBRL(safeDiv(spend, adLeads))} hint="Leads vindos de anúncios" />
        <Stat label="Campanhas ativas" value={fmtInt(campaigns.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="eyebrow">Funil</p>
          <ul className="mt-5 space-y-3">
            {stages.map((s) => {
              const n = stageCount.get(s.id) ?? 0;
              return (
                <li key={s.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-300">{s.name}</span>
                    <span className="tabular-nums text-ink-400">{fmtInt(n)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-ink-800">
                    <div
                      className={`h-1.5 rounded-full ${s.isWon ? "bg-dyn-orange" : s.isLost ? "bg-ink-500" : "bg-ink-300"}`}
                      style={{ width: `${(n / maxStage) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <p className="eyebrow">Leads por origem</p>
          {summary.bySource.length === 0 ? (
            <p className="mt-5 text-sm text-ink-500">Nenhum lead no período.</p>
          ) : (
            <ul className="mt-5 divide-y divide-ink-800">
              {summary.bySource
                .sort((a, b) => Number(b.total) - Number(a.total))
                .map((r) => (
                  <li key={r.source} className="flex justify-between py-2.5 text-sm">
                    <span className="text-ink-300">{SOURCE_LABEL[r.source] ?? r.source}</span>
                    <span className="tabular-nums">{fmtInt(Number(r.total))}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
