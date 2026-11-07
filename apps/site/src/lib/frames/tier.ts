import type { Tier } from "./manifest";

/**
 * Qual conjunto de frames baixar. Decide pelo LADO MENOR da tela: um celular deitado (844×390) continua sendo um
 * celular e recebe os frames leves (960 px); só telas de desktop (lado menor acima de 768 px) recebem os de 1920 px.
 */
export function pickTier(width: number, height: number): Tier {
  return Math.min(width, height) <= 768 ? "mobile" : "desktop";
}
