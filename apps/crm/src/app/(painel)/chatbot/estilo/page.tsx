import type { Metadata } from "next";
import { countExamples, getConfig, listExamples, listStyleUploads } from "@dynamo/chatbot";
import { requireManager } from "@/lib/chatbot";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Card, CardTitle, CtaButton, EmptyState, GhostButton, PageHeader } from "@/components/ui";
import { applyDraftAction, discardDraftAction, removeExampleAction } from "../actions";
import { GenerateGuideButton, GuideEditor, StyleUpload } from "../forms";

export const metadata: Metadata = { title: "Estilo de fala" };

export default async function EstiloPage() {
  const { organization } = await requireManager();
  const [config, total, examples, uploads] = await Promise.all([
    getConfig(db, organization.id),
    countExamples(db, organization.id),
    listExamples(db, organization.id, 30),
    listStyleUploads(db, organization.id),
  ]);

  return (
    <>
      <PageHeader eyebrow="Chatbot" title="Estilo de fala" highlight="fala" support="O bot imita o jeito do seu atendente." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardTitle>1. Conversas do atendente</CardTitle>
          <p className="text-sm text-gray-300">No WhatsApp do atendente, abra uma conversa com cliente → ⋮ → Mais → Exportar conversa → sem mídia. Suba o arquivo aqui. Quanto mais conversas, melhor.</p>
          <StyleUpload />
          {uploads.length > 0 && (
            <ul className="space-y-1 text-xs text-gray-500">
              {uploads.map((u) => (
                <li key={u.id}>{fmtDate(u.createdAt)} · {u.fileName} · {u.examples} exemplos ({u.agentName})</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <CardTitle>2. Guia de estilo</CardTitle>
            <GenerateGuideButton disabled={total === 0} />
          </div>
          {config.styleGuideDraft && (
            <div className="space-y-3 rounded-[8px] border border-amber/60 p-4">
              <p className="footer-line !text-amber">Proposta gerada pela IA</p>
              <p className="max-h-60 overflow-y-auto whitespace-pre-line text-sm text-mist">{config.styleGuideDraft}</p>
              <div className="flex gap-3">
                <form action={applyDraftAction}><CtaButton type="submit">Usar proposta</CtaButton></form>
                <form action={discardDraftAction}><GhostButton type="submit">Descartar</GhostButton></form>
              </div>
            </div>
          )}
          <GuideEditor value={config.styleGuide} />
        </Card>
      </div>
      <section className="space-y-4">
        <p className="eyebrow eyebrow-muted">Exemplos ({total})</p>
        {examples.length === 0 ? (
          <EmptyState title="Sem exemplos ainda" text="Os pares pergunta → resposta do atendente aparecem aqui depois do primeiro upload." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {examples.map((e) => (
              <li key={e.id} className="rounded-[12px] border border-graphite bg-panel p-4 text-sm">
                <p className="text-gray-300">{e.customerText}</p>
                <p className="mt-2 text-white">{e.agentText}</p>
                <form action={removeExampleAction} className="mt-3">
                  <input type="hidden" name="exampleId" value={e.id} />
                  <button type="submit" className="footer-line hover:!text-amber">Remover</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
