import type { Metadata } from "next";
import { LabTitle } from "./LabTitle";

export const metadata: Metadata = { title: "Laboratório do título 3D", robots: { index: false, follow: false } };

/** Rota de laboratório para os testes e2e: só existe em builds com NEXT_PUBLIC_E2E=1 e no `next dev` (ver pageExtensions em next.config.ts); em produção a rota nem é gerada. */
export default function TitleLabPage() {
  return <LabTitle />;
}
