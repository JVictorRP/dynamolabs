import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de privacidade · Dynamo" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade">
      <p>A Dynamo trata os dados que você envia pelo formulário de contato (nome, e-mail, telefone e mensagem) apenas para responder ao seu pedido.</p>
      <p>Você pode pedir a exclusão dos seus dados a qualquer momento, escrevendo para o e-mail de contato do site.</p>
    </LegalPage>
  );
}
