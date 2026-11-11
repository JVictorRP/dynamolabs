import type { Metadata } from "next";
import Link from "next/link";
import { listConversations } from "@dynamo/chatbot";
import { requireManager } from "@/lib/chatbot";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Conversas" };

export default async function ConversasPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { organization } = await requireManager();
  const { modo } = await searchParams;
  const mode = modo === "humano" ? "humano" : undefined;
  const rows = await listConversations(db, organization.id, { mode });

  return (
    <>
      <PageHeader eyebrow="Chatbot" title="Conversas" highlight="Conversas" support="As mais recentes primeiro.">
        <nav className="flex rounded-[8px] border border-graphite bg-panel p-1">
          <Link href="/chatbot/conversas" className={`footer-line rounded-[6px] px-3 py-2 ${!mode ? "bg-graphite !text-white" : ""}`}>Todas</Link>
          <Link href="/chatbot/conversas?modo=humano" className={`footer-line rounded-[6px] px-3 py-2 ${mode ? "bg-graphite !text-white" : ""}`}>Com humano</Link>
        </nav>
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma conversa" text="Quando clientes escreverem para o número do bot, as conversas aparecem aqui." />
      ) : (
        <ul className="divide-y divide-graphite rounded-[12px] border border-graphite bg-panel">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/chatbot/conversas/${c.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-panel-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{c.contactName ?? c.waId}</p>
                  <p className="truncate text-sm text-gray-300">{c.lastText ?? "—"}</p>
                </div>
                {c.mode === "humano" && <span className="rounded-[4px] bg-amber px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite">Humano</span>}
                <span className="footer-line shrink-0">{fmtDate(c.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
