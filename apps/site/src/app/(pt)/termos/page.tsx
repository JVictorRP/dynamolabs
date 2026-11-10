import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { activeLangs } from "@/content/status";
import { legalMetadata } from "@/lib/i18n/seo";

export const generateMetadata = (): Metadata => legalMetadata("pt", "terms", activeLangs());

export default function TermsPage() {
  return <LegalPage lang="pt" page="terms" />;
}
