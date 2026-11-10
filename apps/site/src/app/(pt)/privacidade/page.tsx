import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { activeLangs } from "@/content/status";
import { legalMetadata } from "@/lib/i18n/seo";

export const generateMetadata = (): Metadata => legalMetadata("pt", "privacy", activeLangs());

export default function PrivacyPage() {
  return <LegalPage lang="pt" page="privacy" />;
}
