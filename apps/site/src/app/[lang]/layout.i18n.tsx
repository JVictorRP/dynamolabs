import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootShell } from "@/components/RootShell";
import { activeLangs } from "@/content/status";
import { DEFAULT_LANG, isLang } from "@/lib/i18n/config";
import { homeMetadata } from "@/lib/i18n/seo";

export const dynamicParams = false;

/** Inglês e espanhol, só os que estão no ar (o português vive em `(pt)`, na raiz). */
export function generateStaticParams() {
  return activeLangs()
    .filter((lang) => lang !== DEFAULT_LANG)
    .map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return homeMetadata(lang, activeLangs());
}

export default async function LangLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  if (!isLang(lang) || lang === DEFAULT_LANG) notFound();
  return <RootShell lang={lang}>{children}</RootShell>;
}
