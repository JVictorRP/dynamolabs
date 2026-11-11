import type { Metadata } from "next";
import Link from "next/link";
import { countExamples, listSheetSources, overview } from "@dynamo/chatbot";
import { requireManager, usdBrl } from "@/lib/chatbot";
import { db } from "@/lib/db";
import { fmtBRL, fmtInt } from "@/lib/format";
import { Card, CardTitle, CtaButton, GhostButton, PageHeader, Stat } from "@/components/ui";
import { toggleBotAction } from "./actions";

export const metadata: Metadata = { title: "Chatbot" };

const NUMBER_LABEL: Record<string, string> = { ativo: "Conectado", com_problema: "Com problema", desligado: "Desligado" };

export default async function ChatbotPage() {
  const { organization } = await requireManager();
  const [o, examples, sheets] = await Promise.all([
    overview(db, organization.id, new Date(), usdBrl()),
    countExamples(db, organization.id),
    listSheetSources(db, organization.id),
  ]);

  const pending: { text: string; href?: string }[] = [];
  if (!o.numberStatus) pending.push({ text: "A Dynamo ainda não ligou um número de WhatsApp a esta empresa." });
  if (o.numberStatus === "com_problema") pending.push({ text: "O número de WhatsApp está com problema (token vencido ou sem permissão). Fale com a Dynamo." });
  if (examples === 0) pending.push({ text: "Suba conversas exportadas para o bot aprender o jeito de falar.", href: "/chatbot/estilo" });
  if (sheets.length === 0) pending.push({ text: "Ligue pelo menos uma planilha com preços, produtos ou horários.", href: "/chatbot/planilhas" });

  return (
    <>
      <PageHeader eyebrow="Chatbot" title="Atendimento no WhatsApp" highlight="WhatsApp" support={o.enabled ? "O bot está respondendo." : "O bot está desligado."}>
        <form action={toggleBotAction}>
          {o.enabled ? (
            <GhostButton type="submit">Desligar bot</GhostButton>
          ) : (
            <>
              <input type="hidden" name="enabled" value="on" />
              <CtaButton type="submit" disabled={!o.numberStatus || o.numberStatus !== "ativo"}>Ligar bot</CtaButton>
            </>
          )}
        </form>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Conversas hoje" value={fmtInt(o.conversationsToday)} accent />
        <Stat label="Leads no mês" value={fmtInt(o.leadsThisMonth)} />
        <Stat label="Gasto da IA no mês" value={fmtBRL(o.spendBrl)} hint={`Teto: ${fmtBRL(o.capBrl)}`} />
        <Stat label="Número" value={o.numberStatus ? NUMBER_LABEL[o.numberStatus] : "—"} />
      </div>

      {pending.length > 0 && (
        <Card>
          <CardTitle>Antes de ligar</CardTitle>
          <ul className="mt-4 space-y-3 text-sm text-mist">
            {pending.map((p) => (
              <li key={p.text} className="flex gap-3">
                <i className="mt-2 size-[7px] shrink-0 rounded-full bg-amber" aria-hidden="true" />
                {p.href ? <Link href={p.href} className="underline decoration-graphite underline-offset-4 hover:text-white">{p.text}</Link> : p.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
