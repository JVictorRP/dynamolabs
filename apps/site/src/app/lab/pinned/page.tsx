import type { Metadata } from "next";
import { LabPinned } from "./LabPinned";

export const metadata: Metadata = { title: "Laboratório do palco preso", robots: { index: false, follow: false } };

/** Rota de laboratório para os testes e2e: só renderiza em builds com NEXT_PUBLIC_E2E=1. */
export default function PinnedLabPage() {
  if (process.env.NEXT_PUBLIC_E2E !== "1") return null;
  return <LabPinned />;
}
