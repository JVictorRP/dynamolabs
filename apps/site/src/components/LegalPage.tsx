import { getLegal } from "@/content/legal/index";
import { statusByLang } from "@/content/status";
import { pathFor, publishedLangs, showAllLanguages, type Lang } from "@/lib/i18n/config";
import { LocaleProvider } from "./LocaleProvider";
import { SiteHeader } from "./SiteHeader";

/** Moldura das páginas legais (servidor). O texto de cada idioma vem de `getLegal` e só vai ao ar depois de aprovado. */
export function LegalPage({ lang, page }: { lang: Lang; page: "privacy" | "terms" }) {
  const legal = getLegal(lang);
  const text = legal[page];
  const languages = publishedLangs(statusByLang(), showAllLanguages());
  return (
    <LocaleProvider lang={lang} page={page} languages={languages}>
      <SiteHeader />
      <main className="mx-auto min-h-svh max-w-3xl px-6 pt-32 pb-24">
        {legal.status !== "final" && (
          <p className="m-0 mb-6 rounded-lg bg-graphite px-4 py-3 font-display text-sm text-amber" role="note">
            {legal.provisionalNotice}
          </p>
        )}
        <h1 className="mb-8 font-display text-[clamp(32px,6vw,64px)] leading-[0.95] font-black tracking-[-0.04em] uppercase">{text.title}</h1>
        <div className="space-y-5 font-display text-lg leading-[1.5] font-light text-mist">
          {text.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <p className="mt-12">
          <a href={pathFor(lang, "home")} className="font-display text-sm font-medium tracking-[0.22em] text-amber uppercase">
            {legal.back}
          </a>
        </p>
      </main>
    </LocaleProvider>
  );
}
