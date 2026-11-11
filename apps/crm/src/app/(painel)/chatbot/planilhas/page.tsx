import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { listSheetSources } from "@dynamo/chatbot";
import { requireManager } from "@/lib/chatbot";
import { db, schema } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Card, CardTitle, EmptyState, GhostButton, PageHeader } from "@/components/ui";
import { removeSheetAction, syncSheetAction } from "../actions";
import { AddSheetForm } from "../forms";

export const metadata: Metadata = { title: "Planilhas" };

function serviceAccountEmail(): string | null {
  try {
    return (JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "") as { client_email?: string }).client_email ?? null;
  } catch {
    return null;
  }
}

export default async function PlanilhasPage() {
  const { organization } = await requireManager();
  const sources = await listSheetSources(db, organization.id);
  const previews = await Promise.all(
    sources.map(({ source }) =>
      db.select({ data: schema.sheetRow.data }).from(schema.sheetRow).where(eq(schema.sheetRow.sourceId, source.id)).orderBy(asc(schema.sheetRow.position)).limit(3),
    ),
  );
  const email = serviceAccountEmail();

  return (
    <>
      <PageHeader eyebrow="Chatbot" title="Planilhas" highlight="Planilhas" support="De onde o bot tira preços, produtos e horários." />
      <Card className="space-y-4">
        <CardTitle>Ligar uma planilha</CardTitle>
        <p className="text-sm text-gray-300">
          No Google Sheets, clique em Compartilhar e adicione como <strong>Leitor</strong> o e-mail{" "}
          <span className="break-all font-mono text-amber">{email ?? "(conta de serviço não configurada no CRM)"}</span>. A primeira linha da aba precisa ter os nomes das colunas.
        </p>
        <AddSheetForm />
      </Card>
      {sources.length === 0 ? (
        <EmptyState title="Nenhuma planilha" text="Sem planilha, o bot não informa preços nem horários: ele passa a conversa para a equipe." />
      ) : (
        <div className="space-y-4">
          {sources.map(({ source, rows }, i) => (
            <Card key={source.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="display text-2xl">{source.label}</p>
                  <p className="footer-line mt-1">
                    Aba {source.tab} · {rows} linhas · {source.lastSyncedAt ? `atualizada ${fmtDate(source.lastSyncedAt)}` : "ainda não copiada"}
                  </p>
                  {source.lastError && <p className="mt-2 text-sm text-amber">{source.lastError}</p>}
                </div>
                <div className="flex gap-2">
                  <form action={syncSheetAction}>
                    <input type="hidden" name="sourceId" value={source.id} />
                    <GhostButton type="submit">Atualizar agora</GhostButton>
                  </form>
                  <form action={removeSheetAction}>
                    <input type="hidden" name="sourceId" value={source.id} />
                    <GhostButton type="submit">Remover</GhostButton>
                  </form>
                </div>
              </div>
              {previews[i].length > 0 && (
                <ul className="space-y-1 text-xs text-gray-300">
                  {previews[i].map((r, j) => (
                    <li key={j} className="truncate">{Object.entries(r.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
