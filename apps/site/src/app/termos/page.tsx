import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termos de uso · Dynamo" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso">
      <p>Este site apresenta os serviços da Dynamo, agência de marketing digital com inteligência artificial e automação.</p>
      <p>O conteúdo é informativo e pode ser atualizado sem aviso prévio.</p>
    </LegalPage>
  );
}
