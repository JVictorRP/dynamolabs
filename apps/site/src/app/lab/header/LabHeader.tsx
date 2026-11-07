"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import type { SiteProgress, SiteSection } from "@/lib/choreo/header-state";

const LINKS = [
  { href: "#servicos", label: "Serviços" },
  { href: "#chatbot", label: "Chatbot" },
];

export function LabHeader() {
  const [progress, setProgress] = useState<SiteProgress>({ section: "hero-s2", p: 0 });
  useEffect(() => {
    window.__labHeader = { set: (section: SiteSection, p: number) => setProgress({ section, p }) };
    return () => {
      delete window.__labHeader;
    };
  }, []);
  return (
    <main className="min-h-svh bg-void">
      <Header progress={progress} links={LINKS} cta={{ href: "#contato", label: "Fale conosco" }} />
    </main>
  );
}
