import { getOrgContext } from "@/lib/context";
import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out";
import { FooterLine, Wordmark } from "@/components/brand";

const NAV = [
  { href: "/", label: "Visão geral" },
  { href: "/leads", label: "Leads e funil" },
  { href: "/campanhas", label: "Campanhas" },
  { href: "/conteudo", label: "Conteúdo" },
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { organization, user } = await getOrgContext();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col border-b border-graphite bg-void md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-5 pb-4 pt-6 md:pb-8">
          <Wordmark />
          <p className="eyebrow mt-4 !text-[0.62rem] !tracking-[0.3em] text-teal">{organization.name}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
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
          <FooterLine>Dynamo Labs · marketing com IA e automação</FooterLine>
        </div>
      </main>
    </div>
  );
}
