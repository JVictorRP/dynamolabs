import { segment } from "../scroll/math";

export type SiteSection = "hero-s2" | "wipe-in" | "chat" | "wipe-out" | "video2" | "footer";
export type SiteProgress = { section: SiteSection; p: number };
export type HeaderVariant = "transparent" | "glass" | "compact" | "light" | "dark-glass";
export type HeaderState = { variant: HeaderVariant; logo: "claro" | "grafite"; indicator: number };

/** Parte da faixa de luz em que a borda branca chega ao topo, onde fica o menu (na subida, no fim; na saída, no começo). */
const EDGE_AT_HEADER = 0.95;

const dark = (variant: HeaderVariant, indicator = 0): HeaderState => ({ variant, logo: "claro", indicator });
const light = (): HeaderState => ({ variant: "light", logo: "grafite", indicator: 0 });

/** Aparência do menu em função da seção e do progresso dentro dela. */
export function headerState({ section, p }: SiteProgress): HeaderState {
  switch (section) {
    case "hero-s2": {
      const indicator = segment(p, 0.45, 0.8);
      if (p < 0.25) return dark("transparent", indicator);
      if (p < 0.45) return dark("glass", indicator);
      return dark("compact", indicator);
    }
    case "wipe-in":
      return p >= EDGE_AT_HEADER ? light() : dark("compact", 1);
    case "chat":
      return light();
    case "wipe-out":
      return p <= 1 - EDGE_AT_HEADER ? light() : dark("dark-glass");
    case "video2":
    case "footer":
      return dark("dark-glass");
  }
}
