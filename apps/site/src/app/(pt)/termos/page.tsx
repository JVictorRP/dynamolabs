import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getLegal } from "@/content/legal/index";

export const metadata: Metadata = { title: getLegal("pt").terms.metaTitle };

export default function TermsPage() {
  return <LegalPage lang="pt" page="terms" />;
}
