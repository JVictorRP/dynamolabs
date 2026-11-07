/** Ponto de foco (0–1 em x e y) em um instante do progresso (`at`, 0–1). Guia o recorte em telas verticais. */
export type FocusKey = { at: number; x: number; y: number };

export type FrameManifest = {
  id: "v1" | "v2";
  /** Quantidade de frames disponíveis (já sem os descartados). */
  frames: number;
  tiers: {
    desktop: { width: 1920; height: number };
    mobile: { width: 960; height: number };
  };
  /** Id dos bytes dos frames (muda se qualquer frame ou pôster mudar). Vai na URL, em `?v=`. */
  version?: string;
  /** Ex.: `/frames/v1/{tier}/{n}.webp?v=<version>` — `{n}` tem 4 dígitos, 1-based. */
  pathPattern: string;
  focus: FocusKey[];
};

export type Tier = "desktop" | "mobile";

/** URL de um frame: `{tier}` e `{n}` (4 dígitos, 1-based) substituídos no `pathPattern`. */
export function frameUrl(manifest: FrameManifest, tier: Tier, index: number): string {
  return manifest.pathPattern.replace("{tier}", tier).replace("{n}", String(index + 1).padStart(4, "0"));
}
