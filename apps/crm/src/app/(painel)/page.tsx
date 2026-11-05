import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { ensureStages, leadSummary } from "@/lib/data/leads";
import { campaignTotals } from "@/lib/data/campaigns";
import { parsePeriod, periodStart, toDay } from "@/lib/data/period";
import { fmtBRL, fmtInt, safeDiv, SOURCE_LABEL } from "@/lib/format";
import { PERIODS } from "@/lib/data/period";
import { Card, CardTitle, PageHeader, PeriodTabs, Stat } from "@/components/ui";

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
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${organization.name}`}
        highlight={organization.name}
        support={`Seus números dos últimos ${PERIODS[period]} dias.`}
      >
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
          <CardTitle>Funil</CardTitle>
          <ul className="mt-6 space-y-4">
            {stages.map((s) => {
              const n = stageCount.get(s.id) ?? 0;
              return (
                <li key={s.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-mist">{s.name}</span>
                    <span className="font-bold tabular-nums text-white">{fmtInt(n)}</span>
                  </div>
                  <div className="mt-2 h-[3px] bg-graphite">
                    <div
                      className={`h-[3px] ${s.isWon ? "bg-amber" : s.isLost ? "bg-gray-500" : "bg-mist"}`}
                      style={{ width: `${(n / maxStage) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle>Leads por origem</CardTitle>
          {summary.bySource.length === 0 ? (
            <p className="mt-6 text-sm text-gray-300">Nenhum lead no período.</p>
          ) : (
            <ul className="mt-4 divide-y divide-graphite">
              {summary.bySource
                .sort((a, b) => Number(b.total) - Number(a.total))
                .map((r) => (
                  <li key={r.source} className="flex justify-between py-3 text-sm">
                    <span className="text-mist">{SOURCE_LABEL[r.source] ?? r.source}</span>
                    <span className="font-bold tabular-nums text-white">{fmtInt(Number(r.total))}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
