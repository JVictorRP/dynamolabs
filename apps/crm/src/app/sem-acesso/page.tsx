import Link from "next/link";
import { headers } from "next/headers";
import { Wordmark } from "@/components/brand";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/staff";

export default async function SemAcesso() {
  const session = await auth.api.getSession({ headers: await headers() });
  const staff = session ? isStaff(session.user.email) : false;
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <Wordmark />
        <p className="eyebrow mt-12">Acesso pendente</p>
        <h1 className="display mt-5 text-4xl">
          Sua conta ainda não tem <span className="text-amber">empresa</span>
        </h1>
        <p className="mt-5 text-gray-300">Fale com a equipe Dynamo para liberar o seu painel.</p>
        {staff && (
          <Link href="/clientes" className="label mt-8 inline-block rounded-[12px] bg-teal px-6 py-3.5 text-[0.7rem] text-graphite">
            Ir para Clientes
          </Link>
        )}
      </div>
    </main>
  );
}
