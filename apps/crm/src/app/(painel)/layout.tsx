import { getOrgContext } from "@/lib/context";
import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out";

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
      <aside className="border-b border-ink-800 bg-ink-900 md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-5 md:block">
          <div>
            <p className="font-display text-sm font-semibold tracking-[0.3em] text-ink-100">DYNAMO</p>
            <p className="mt-1 text-xs text-ink-500">{organization.name}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 py-6 md:block">
          <p className="truncate text-xs text-ink-400">{user.name}</p>
          <p className="truncate text-xs text-ink-500">{user.email}</p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 px-5 py-8 md:px-10">
        <div className="mx-auto max-w-6xl space-y-8">{children}</div>
      </main>
    </div>
  );
}
