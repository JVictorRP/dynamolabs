import type { Metadata } from "next";
import { RootShell } from "@/components/RootShell";
import { activeLangs } from "@/content/status";
import { homeMetadata } from "@/lib/i18n/seo";

export const generateMetadata = (): Metadata => homeMetadata("pt", activeLangs());

/** Layout raiz do português (URL `/`, sem prefixo). Inglês e espanhol têm o deles em `[lang]`. */
export default function PtLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootShell lang="pt">{children}</RootShell>;
}
