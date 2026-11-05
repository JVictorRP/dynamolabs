import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { ensureStages, listLeads } from "@/lib/data/leads";
import { fmtDate, SOURCE_LABEL } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { moveLeadAction } from "./actions";

export const metadata: Metadata = { title: "Leads e funil" };

export default async function LeadsPage() {
  const { organization } = await getOrgContext();
  const [stages, leads] = await Promise.all([ensureStages(organization.id), listLeads(organization.id)]);

  return (
    <>
      <PageHeader eyebrow="Leads e funil" title="Seus leads" highlight="leads" support="Do primeiro contato ao fechamento." />
      {leads.length === 0 ? (
        <EmptyState
          title="Nenhum lead ainda"
          text="Assim que as campanhas de Meta e Google começarem a gerar contatos, eles aparecem aqui automaticamente."
        />
      ) : (
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-4 md:mx-0 md:px-0">
          {stages.map((stage) => {
            const items = leads.filter((l) => l.stageId === stage.id);
            return (
              <section key={stage.id} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between border-b border-graphite pb-3">
                  <h2 className="footer-line !text-mist">{stage.name}</h2>
                  <span className={`text-sm font-bold tabular-nums ${stage.isWon ? "text-amber" : "text-white"}`}>{items.length}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((lead) => (
                    <li key={lead.id} className="rounded-[12px] border border-graphite bg-panel p-4">
                      <p className="truncate text-sm font-bold text-white">{lead.name || lead.email || lead.phone || "Sem nome"}</p>
                      <p className="mt-1 truncate text-xs text-gray-300">
                        {[lead.phone, lead.email].filter(Boolean).join(" · ") || "Sem contato"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-[4px] bg-graphite px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-mist">{SOURCE_LABEL[lead.source]}</span>
                        {lead.campaignName && (
                          <span className="max-w-full truncate rounded-[4px] border border-graphite px-1.5 py-0.5 text-gray-300">
                            {lead.campaignName}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-500">{fmtDate(lead.createdAt)}</span>
                        <form action={moveLeadAction} className="flex items-center gap-1">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <select
                            name="stageId"
                            defaultValue={stage.id}
                            className="rounded-[4px] border border-graphite bg-panel-2 px-1.5 py-1 text-[11px] text-mist"
                          >
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button className="label rounded-[4px] bg-teal px-2 py-1 text-[9px] text-graphite hover:brightness-110">
                            Mover
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
