import { Wordmark } from "@/components/brand";

export default function SemAcesso() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <Wordmark />
        <p className="eyebrow mt-12">Acesso pendente</p>
        <h1 className="display mt-5 text-4xl">
          Sua conta ainda não tem <span className="text-amber">empresa</span>
        </h1>
        <p className="mt-5 text-gray-300">Fale com a equipe Dynamo para liberar o seu painel.</p>
      </div>
    </main>
  );
}
