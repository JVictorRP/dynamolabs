import { getCopy } from "@/content/copy/index";
import { activeLangs } from "@/content/status";
import type { Lang } from "@/lib/i18n/config";
import { ChatSection } from "./ChatSection";
import { Footer } from "./Footer";
import { HeroStage } from "./HeroStage";
import { LocaleProvider } from "./LocaleProvider";
import { SiteHeader } from "./SiteHeader";
import { StageAnchors } from "./StageAnchors";
import { ChatStatic, HeroStatic, Section2Static, Video2Static } from "./StaticSections";
import { Video2Stage } from "./Video2Stage";

/** Página inicial de um idioma. Servidor: calcula os idiomas no ar e entrega a todos os componentes de cliente. */
export function HomePage({ lang }: { lang: Lang }) {
  const copy = getCopy(lang);
  const languages = activeLangs();
  return (
    <LocaleProvider lang={lang} page="home" languages={languages}>
      <a
        href="#top"
        className="absolute top-3 left-3 z-[60] -translate-y-24 rounded-lg bg-teal px-4 py-3 font-label text-xs font-bold tracking-[0.2em] text-graphite uppercase focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {copy.skip}
      </a>
      <SiteHeader />
      <StageAnchors />
      <main id="top">
        <HeroStage />
        <ChatSection />
        <Video2Stage />
        {/* Sem JavaScript: seções estáticas no lugar dos palcos (que o CSS esconde em `scripting: none`). */}
        <noscript>
          <HeroStatic copy={copy} />
          <Section2Static copy={copy} />
          <ChatStatic copy={copy} />
          <Video2Static copy={copy} />
        </noscript>
      </main>
      <Footer lang={lang} />
    </LocaleProvider>
  );
}
