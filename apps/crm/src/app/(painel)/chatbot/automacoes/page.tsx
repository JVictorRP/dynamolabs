import type { Metadata } from "next";
import { getConfig } from "@dynamo/chatbot";
import { requireManager } from "@/lib/chatbot";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { AutomationsForm } from "../forms";

export const metadata: Metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const { organization } = await requireManager();
  const c = await getConfig(db, organization.id);
  return (
    <>
      <PageHeader eyebrow="Chatbot" title="Automações" highlight="Automações" support="O que o bot pode fazer sozinho." />
      <Card>
        <AutomationsForm
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
    </>
  );
}
