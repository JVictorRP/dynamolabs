import { baseMetadata, RootShell } from "@/components/RootShell";

export const metadata = baseMetadata;

/** Layout raiz do português (URL `/`, sem prefixo). Inglês e espanhol têm o deles em `[lang]`. */
export default function PtLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootShell lang="pt">{children}</RootShell>;
}
