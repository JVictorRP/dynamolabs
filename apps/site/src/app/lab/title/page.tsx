import type { Metadata } from "next";
import { LabTitle } from "./LabTitle";

export const metadata: Metadata = { title: "Laboratório do título 3D", robots: { index: false, follow: false } };

/** Rota de laboratório para os testes e2e: só renderiza em builds com NEXT_PUBLIC_E2E=1. */
export default function TitleLabPage() {
  if (process.env.NEXT_PUBLIC_E2E !== "1") return null;
  return <LabTitle />;
}
