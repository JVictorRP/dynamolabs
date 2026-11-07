import { segment } from "../scroll/math";

export type SiteSection = "hero-s2" | "chat" | "video2" | "footer";
export type SiteProgress = { section: SiteSection; p: number };
export type HeaderVariant = "transparent" | "glass" | "compact" | "light" | "dark-glass";
export type HeaderState = { variant: HeaderVariant; logo: "claro" | "grafite"; indicator: number };

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
    case "chat":
      return light();
    case "video2":
    case "footer":
      return dark("dark-glass");
  }
}
