"use client";

import { useSiteProgress } from "@/lib/choreo/use-site-progress";
import { Header } from "./Header";
import { useCopy } from "./LocaleProvider";

/** Menu do site ligado ao progresso real do scroll, no idioma da página. */
export function SiteHeader() {
  const copy = useCopy();
  return <Header progress={useSiteProgress()} links={copy.nav.links} cta={copy.nav.cta} labels={{ mainNav: copy.aria.mainNav, home: copy.aria.home }} />;
}
