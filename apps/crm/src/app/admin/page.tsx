import type { Metadata } from "next";
import { Wordmark } from "@/components/brand";
import { LigarWhatsappForm, StatusWhatsappForm, TitularForm } from "./chatbot-forms";
import { NovoClienteForm } from "./form";

export const metadata: Metadata = { title: "Novo cliente" };

/** Tela interna da Dynamo para cadastrar clientes. Protegida pela chave ADMIN_TOKEN. */
export default function AdminPage() {
  return (
    <main className="flex min-h-dvh justify-center bg-void px-6 py-14">
      <div className="w-full max-w-md">
        <Wordmark />
        <p className="eyebrow mt-12">Uso interno</p>
        <h1 className="display mt-4 text-5xl">
          Novo <span className="text-amber">cliente</span>
        </h1>
        <p className="display-light mt-2 text-2xl">empresa, acesso e chave do n8n.</p>
        <NovoClienteForm />

        <p className="eyebrow mt-20">Chatbot</p>
        <h2 className="display mt-4 text-4xl">
          Ligar <span className="text-amber">WhatsApp</span>
        </h2>
        <p className="display-light mt-2 text-xl">número da Cloud API para uma empresa.</p>
        <LigarWhatsappForm />

        <h2 className="display mt-16 text-3xl">Desligar ou reativar número</h2>
        <StatusWhatsappForm />

        <h2 className="display mt-16 text-3xl">
          Exclusão a pedido do <span className="text-amber">titular</span>
        </h2>
        <p className="display-light mt-2 text-xl">LGPD: apaga as conversas de um telefone.</p>
        <TitularForm />
      </div>
    </main>
  );
}
