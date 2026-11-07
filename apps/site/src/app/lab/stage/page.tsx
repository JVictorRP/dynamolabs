import type { Metadata } from "next";
import { LabStage } from "./LabStage";

export const metadata: Metadata = { title: "Laboratório do palco", robots: { index: false, follow: false } };

/** Rota de laboratório para os testes e2e: só renderiza em builds com NEXT_PUBLIC_E2E=1. */
export default function StageLabPage() {
  if (process.env.NEXT_PUBLIC_E2E !== "1") return null;
  return <LabStage />;
}
