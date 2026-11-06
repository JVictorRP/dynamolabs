import type { Metadata } from "next";
import { Wordmark } from "@/components/brand";
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
      </div>
    </main>
  );
}
