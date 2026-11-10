"use client";

import { useSiteProgress } from "@/lib/choreo/use-site-progress";
import { Header } from "./Header";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useCopy, useLanguages } from "./LocaleProvider";

/** Menu do site ligado ao progresso real do scroll, no idioma da página e com o seletor de idioma. */
export function SiteHeader() {
  const copy = useCopy();
  const languages = useLanguages();
  return (
    <Header
      progress={useSiteProgress()}
      links={copy.nav.links}
      cta={copy.nav.cta}
      labels={{ mainNav: copy.aria.mainNav, home: copy.aria.home }}
      switcher={<LanguageSwitcher languages={languages} />}
    />
  );
}
