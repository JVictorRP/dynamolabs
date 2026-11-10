import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TITLE_SIZE_EM } from "../src/content/title-sizes";
import { LANGS } from "../src/lib/i18n/config";
import { heroLayout } from "../src/lib/stage/layout";

const css = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** A fórmula de `.hero-vars` (globals.css), reescrita aqui em JS: o que o navegador calcula antes de o JS medir o palco. */
function cssHero(w: number, h: number, widthEm: number) {
  const margin = clamp(0.05 * w, 20, 72);
  const portrait = w / h < 0.9; // @media (max-aspect-ratio: 9/10)
  const cap = (portrait ? 0.72 * (w - 2 * margin) : 0.45 * w) / widthEm;
  return { fontPx: clamp(Math.min(0.083 * w, 0.122 * h, cap), 20, 92), left: margin, bottom: clamp(0.12 * h, 48, 120) };
}

describe("the hero block rendered by CSS (server HTML) matches heroLayout (client JS), in every language", () => {
  for (const lang of LANGS) {
    for (const [w, h] of [[1440, 900], [1920, 1080], [2560, 1440], [1280, 720], [390, 844], [412, 915], [320, 568], [844, 390], [768, 1024], [1024, 768]]) {
      it(`${lang} ${w}x${h}`, () => {
        const widthEm = TITLE_SIZE_EM[lang].hero.width;
        const js = heroLayout({ w, h }, { widthEm });
        const expected = cssHero(w, h, widthEm);
        expect(js.fontPx).toBeCloseTo(expected.fontPx, 2);
        expect(js.left).toBeCloseTo(expected.left, 2);
        expect(js.bottom).toBeCloseTo(expected.bottom, 2);
      });
    }
  }

  it("globals.css really uses the same constants (guards the CSS side of the parity)", () => {
    expect(css).toContain("--hero-margin: clamp(20px, 5vw, 72px)");
    expect(css).toContain("--hero-bottom: clamp(48px, 12svh, 120px)");
    // A largura do título em em vem de --hero-width-em (definida inline a partir do idioma; o padrão é a do português).
    expect(css).toContain(`--hero-width-em: ${TITLE_SIZE_EM.pt.hero.width}`);
    expect(css).toContain("min(8.3vw, 12.2svh, calc(45vw / var(--hero-width-em)))");
    expect(css).toContain("calc(0.72 * (100vw - 2 * var(--hero-margin)) / var(--hero-width-em))");
    expect(css).toContain("@media (max-aspect-ratio: 9/10)");
    expect(css).toMatch(/clamp\(20px, min\(8\.3vw/);
  });
});
