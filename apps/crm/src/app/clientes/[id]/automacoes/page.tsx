import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig } from "@dynamo/chatbot";
import { getClient } from "@/lib/accounts";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { AutomationsForm } from "./forms";

export const metadata: Metadata = { title: "Automações do cliente" };

/** Só a equipe da Dynamo (o layout de /clientes já exige DYNAMO_STAFF_EMAILS). */
export default async function ClienteAutomacoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(db, id);
  if (!client) notFound();
  const c = await getConfig(db, client.id);
  return (
    <>
      <PageHeader eyebrow={client.name} title="Automações do chatbot" highlight="chatbot" support="O que o bot pode fazer sozinho nesta empresa." />
      <Card>
        <AutomationsForm
          organizationId={client.id}
          values={{
            actions: c.actions,
            n8nWebhookUrl: c.n8nWebhookUrl ?? "",
            ownerPhone: c.ownerPhone ?? "",
            nonTextPolicy: c.nonTextPolicy,
            handoffHours: c.handoffHours,
            monthlyCapBrl: c.monthlyCapBrl,
            extraRules: c.extraRules,
          }}
        />
      </Card>
      <Link href={`/clientes/${client.id}`} className="footer-line hover:!text-white">← Voltar ao cliente</Link>
    </>
  );
}
