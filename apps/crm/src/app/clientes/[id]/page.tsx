import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/accounts";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { AddMemberForm, ResetPasswordButton } from "../forms";

export const metadata: Metadata = { title: "Cliente" };

const ROLE: Record<string, string> = { owner: "Dono", admin: "Admin", member: "Membro" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(db, id);
  if (!client) notFound();
  const loginUrl = `${(process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}/login`;
  return (
    <>
      <PageHeader eyebrow="Cliente" title={client.name} support={`slug ${client.slug} · desde ${fmtDate(client.createdAt)}`} />
      <Card className="space-y-3">
        <CardTitle>Conteúdo do Instagram</CardTitle>
        <p className="text-sm text-gray-300">Monte os posts, veja a prévia no celular e mande o link para o cliente aprovar.</p>
        <Link href={`/clientes/${client.id}/conteudo`} className="label inline-block rounded-[12px] bg-teal px-6 py-3.5 text-[0.7rem] text-graphite">Abrir conteúdo</Link>
      </Card>
      <Card className="space-y-5">
        <CardTitle>Pessoas com acesso</CardTitle>
        <ul className="divide-y divide-graphite">
          {client.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{m.name}</p>
                <p className="break-all text-sm text-gray-300">{m.email} · {ROLE[m.role] ?? m.role}</p>
              </div>
              <ResetPasswordButton organizationId={client.id} userId={m.userId} nome={m.name} email={m.email} loginUrl={loginUrl} />
            </li>
          ))}
        </ul>
      </Card>
      <Card className="space-y-5">
        <CardTitle>Adicionar pessoa</CardTitle>
        <p className="text-sm text-gray-300">Se o e-mail já tem acesso a outra empresa, a pessoa só ganha acesso a esta e continua com a senha atual.</p>
        <AddMemberForm organizationId={client.id} loginUrl={loginUrl} />
      </Card>
      <Link href="/clientes" className="footer-line hover:!text-white">← Voltar aos clientes</Link>
    </>
  );
}
