import { notFound } from "next/navigation";
import { HomePage } from "@/components/HomePage";
import { isLang } from "@/lib/i18n/config";

export default async function LangHome({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <HomePage lang={lang} />;
}
