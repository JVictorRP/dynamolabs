"use client";

import { COPY } from "@/content/copy";
import { useSiteProgress } from "@/lib/choreo/use-site-progress";
import { Header } from "./Header";

/** Menu do site ligado ao progresso real do scroll. */
export function SiteHeader() {
  return <Header progress={useSiteProgress()} links={COPY.nav.links} cta={COPY.nav.cta} />;
}
