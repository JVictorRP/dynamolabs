import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { ensureStages, listLeads } from "@/lib/data/leads";
import { EmptyState, PageHeader } from "@/components/ui";
import { LeadBoard } from "./lead-board";

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
        <LeadBoard
          stages={stages.map((s) => ({ id: s.id, name: s.name, isWon: s.isWon }))}
          leads={leads.map((l) => ({
            id: l.id,
            stageId: l.stageId,
            name: l.name,
            email: l.email,
            phone: l.phone,
            source: l.source,
            campaignName: l.campaignName,
            createdAt: l.createdAt.toISOString(),
          }))}
        />
      )}
    </>
  );
}
