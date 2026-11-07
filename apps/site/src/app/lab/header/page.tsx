import type { Metadata } from "next";
import { LabHeader } from "./LabHeader";

export const metadata: Metadata = { title: "Laboratório do menu", robots: { index: false, follow: false } };

/** Rota de laboratório para os testes e2e: só renderiza em builds com NEXT_PUBLIC_E2E=1. */
export default function HeaderLabPage() {
  if (process.env.NEXT_PUBLIC_E2E !== "1") return null;
  return <LabHeader />;
}
