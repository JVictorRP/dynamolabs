import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { activeLangs } from "@/content/status";
import { DEFAULT_LANG, isLang, legalSlugs, pageFromSlug } from "@/lib/i18n/config";
import { legalMetadata } from "@/lib/i18n/seo";

export const dynamicParams = false;

/** /en/privacy, /en/terms, /es/privacidad, /es/terminos (só dos idiomas no ar). */
export function generateStaticParams() {
  return activeLangs()
    .filter((lang) => lang !== DEFAULT_LANG)
    .flatMap((lang) => legalSlugs(lang).map(({ slug }) => ({ lang, legal: slug })));
}

type Params = Promise<{ lang: string; legal: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, legal } = await params;
  const page = isLang(lang) ? pageFromSlug(lang, legal) : null;
  return isLang(lang) && page ? legalMetadata(lang, page, activeLangs()) : {};
}

export default async function LegalRoute({ params }: { params: Params }) {
  const { lang, legal } = await params;
  const page = isLang(lang) ? pageFromSlug(lang, legal) : null;
  if (!isLang(lang) || !page) notFound();
  return <LegalPage lang={lang} page={page} />;
}
