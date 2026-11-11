import Link from "next/link";
import { FooterLine, Wordmark } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out";
import { requireStaff } from "@/lib/staff";

/** Área interna da Dynamo: só e-mails de DYNAMO_STAFF_EMAILS. Não depende de pertencer a uma empresa. */
export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col border-b border-graphite bg-void md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-5 pb-4 pt-6 md:pb-8">
          <Wordmark />
          <p className="eyebrow mt-4 !text-[0.62rem] !tracking-[0.3em] text-teal">Equipe Dynamo</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          <Link href="/clientes" className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-[8px] bg-graphite px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white">
            <i className="size-[7px] rounded-full bg-teal" aria-hidden="true" />
            Clientes
          </Link>
          <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-[8px] px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-gray-300 hover:text-white">
            <i className="size-[7px] rounded-full bg-transparent" aria-hidden="true" />
            Meu painel
          </Link>
        </nav>
        <div className="mt-auto hidden space-y-1 border-t border-graphite px-5 py-6 md:block">
          <p className="truncate text-sm text-mist">{user.name}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
          <div className="pt-3">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex flex-1 flex-col px-5 py-10 md:px-12">
        <div className="mx-auto w-full max-w-6xl flex-1 space-y-10">{children}</div>
        <div className="mx-auto mt-16 w-full max-w-6xl">
          <FooterLine>Dynamo Labs · uso interno</FooterLine>
        </div>
      </main>
    </div>
  );
}
