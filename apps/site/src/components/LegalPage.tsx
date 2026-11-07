import { LEGAL } from "@/content/legal";
import { SiteHeader } from "./SiteHeader";

/** Moldura das páginas legais. O texto de cada uma é provisório até o jurídico/LGPD aprovar a versão final. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-svh max-w-3xl px-6 pt-32 pb-24">
        {LEGAL.status !== "final" && (
          <p className="m-0 mb-6 rounded-lg bg-graphite px-4 py-3 font-display text-sm text-amber" role="note">
            Texto provisório: esta página será substituída pela versão aprovada antes da publicação do site.
          </p>
        )}
        <h1 className="mb-8 font-display text-[clamp(32px,6vw,64px)] leading-[0.95] font-black tracking-[-0.04em] uppercase">{title}</h1>
        <div className="space-y-5 font-display text-lg leading-[1.5] font-light text-mist">{children}</div>
        <p className="mt-12">
          <a href="/" className="font-display text-sm font-medium tracking-[0.22em] text-amber uppercase">
            Voltar ao início
          </a>
        </p>
      </main>
    </>
  );
}
