import { notFound } from "next/navigation";
import { baseMetadata, RootShell } from "@/components/RootShell";
import { isLang, LANGS, DEFAULT_LANG } from "@/lib/i18n/config";

export const metadata = baseMetadata;
export const dynamicParams = false;

/** Inglês e espanhol (o português vive em `(pt)`, na raiz). */
export function generateStaticParams() {
  return LANGS.filter((lang) => lang !== DEFAULT_LANG).map((lang) => ({ lang }));
}

export default async function LangLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  if (!isLang(lang) || lang === DEFAULT_LANG) notFound();
  return <RootShell lang={lang}>{children}</RootShell>;
}
