import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canReplyManually, getConversation, isHumanMode } from "@dynamo/chatbot";
import { requireManager } from "@/lib/chatbot";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Card, CtaButton, GhostButton, PageHeader } from "@/components/ui";
import { releaseAction, takeOverAction } from "../../actions";
import { ManualReplyForm } from "../../forms";

export const metadata: Metadata = { title: "Conversa" };

const AUTHOR: Record<string, string> = { cliente: "Cliente", bot: "Bot", humano: "Equipe" };

export default async function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireManager();
  const { id } = await params;
  const conv = await getConversation(db, organization.id, id);
  if (!conv) notFound();
  const now = new Date();
  const human = isHumanMode(conv, now);

  return (
    <>
      <PageHeader eyebrow="Conversa" title={conv.contactName ?? conv.waId} support={`+${conv.waId}`}>
        <form action={human ? releaseAction : takeOverAction}>
          <input type="hidden" name="conversationId" value={conv.id} />
          {human ? <GhostButton type="submit">Devolver ao bot</GhostButton> : <CtaButton type="submit">Assumir</CtaButton>}
        </form>
      </PageHeader>
      {human && conv.handoffUntil && (
        <p className="text-sm text-amber">Em modo humano até {fmtDate(conv.handoffUntil)}: o bot não responde esta conversa.</p>
      )}
      <Card className="space-y-4">
        {conv.messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-[12px] px-4 py-3 text-sm ${m.author === "cliente" ? "bg-panel-2 text-mist" : "ml-auto bg-graphite text-white"}`}>
            <p className="footer-line mb-1">{AUTHOR[m.author]} · {fmtDate(m.createdAt)}</p>
            <p className="whitespace-pre-line">{m.text ?? `[${m.type}]`}</p>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">Ações: {m.toolCalls.map((t) => `${t.name}${t.ok ? "" : " (erro)"}`).join(", ")}</p>
            )}
          </div>
        ))}
      </Card>
      <Card>
        <ManualReplyForm conversationId={conv.id} allowed={canReplyManually(conv, now)} />
      </Card>
      <Link href="/chatbot/conversas" className="footer-line hover:!text-white">← Voltar às conversas</Link>
    </>
  );
}
