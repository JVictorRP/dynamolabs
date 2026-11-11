import type { Metadata } from "next";
import Link from "next/link";
import { listClients } from "@/lib/accounts";
import { db } from "@/lib/db";
import { fmtDate, fmtInt } from "@/lib/format";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { NovoClienteForm } from "./forms";

export const metadata: Metadata = { title: "Clientes" };

const WHATSAPP: Record<string, string> = { ativo: "Conectado", com_problema: "Com problema", desligado: "Desligado" };

export default async function ClientesPage() {
  const clients = await listClients(db, new Date());
  const loginUrl = `${(process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}/login`;
  return (
    <>
      <PageHeader eyebrow="Equipe Dynamo" title="Clientes" highlight="Clientes" support={`${clients.length} empresa(s) no painel.`} />
      <Card className="space-y-5">
        <CardTitle>Novo cliente</CardTitle>
        <p className="text-sm text-gray-300">Cria a empresa e o primeiro acesso (dono). A senha é gerada e aparece uma única vez, com uma mensagem pronta para mandar.</p>
        <NovoClienteForm loginUrl={loginUrl} />
      </Card>
      <ul className="divide-y divide-graphite rounded-[12px] border border-graphite bg-panel">
        {clients.map((c) => (
          <li key={c.id}>
            <Link href={`/clientes/${c.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-panel-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{c.name}</span>
              <span className="footer-line">{fmtInt(c.members)} pessoa(s)</span>
              <span className="footer-line">{fmtInt(c.leadsThisMonth)} leads no mês</span>
              <span className="footer-line">WhatsApp: {c.whatsappStatus ? WHATSAPP[c.whatsappStatus] : "—"}</span>
              <span className="footer-line">desde {fmtDate(c.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
