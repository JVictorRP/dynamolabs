import type { Metadata } from "next";
import { simulationTranscript } from "@dynamo/chatbot";
import { createMessageOrNull, requireManager } from "@/lib/chatbot";
import { db } from "@/lib/db";
import { Card, GhostButton, PageHeader } from "@/components/ui";
import { resetSimulationAction } from "../actions";
import { SimulatorForm } from "../forms";

export const metadata: Metadata = { title: "Simulador" };

export default async function SimuladorPage() {
  const { organization, user } = await requireManager();
  const transcript = await simulationTranscript(db, organization.id, user.id);
  const ready = createMessageOrNull() !== null;

  return (
    <>
      <PageHeader eyebrow="Chatbot" title="Simulador" highlight="Simulador" support="Teste o bot sem WhatsApp. As ações só mostram o que fariam.">
        <form action={resetSimulationAction}><GhostButton type="submit">Nova conversa</GhostButton></form>
      </PageHeader>
      {!ready && <p className="text-sm text-amber">Configure ANTHROPIC_API_KEY no CRM para usar o simulador.</p>}
      <Card className="space-y-4">
        {transcript.length === 0 && <p className="text-sm text-gray-300">Mande uma mensagem como se fosse um cliente.</p>}
        {transcript.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-[12px] px-4 py-3 text-sm ${m.author === "cliente" ? "ml-auto bg-graphite text-white" : "bg-panel-2 text-mist"}`}>
            <p className="whitespace-pre-line">{m.text}</p>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <p className="mt-2 text-xs text-teal">{m.toolCalls.map((t) => `${t.name}${t.ok ? "" : " (erro)"}`).join(" · ")}</p>
            )}
          </div>
        ))}
      </Card>
      <SimulatorForm />
    </>
  );
}
