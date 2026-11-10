import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getLegal } from "@/content/legal/index";

export const metadata: Metadata = { title: getLegal("pt").privacy.metaTitle };

export default function PrivacyPage() {
  return <LegalPage lang="pt" page="privacy" />;
}
