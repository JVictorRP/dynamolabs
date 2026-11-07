import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TITLE_SIZE_EM } from "../src/content/title-sizes";
import { heroLayout } from "../src/lib/stage/layout";

const css = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** A fórmula de `.hero-vars` (globals.css), reescrita aqui em JS: o que o navegador calcula antes de o JS medir o palco. */
function cssHero(w: number, h: number) {
  const margin = clamp(0.05 * w, 20, 72);
  const portrait = w / h < 0.9; // @media (max-aspect-ratio: 9/10)
  const cap = (portrait ? w - 2 * margin : 0.62 * w) / 8.92;
  return { fontPx: clamp(Math.min(0.115 * w, 0.17 * h, cap), 24, 128), left: margin, bottom: clamp(0.12 * h, 48, 120) };
}

describe("the hero block rendered by CSS (server HTML) matches heroLayout (client JS)", () => {
  for (const [w, h] of [[1440, 900], [1920, 1080], [2560, 1440], [1280, 720], [390, 844], [412, 915], [320, 568], [844, 390], [768, 1024], [1024, 768]]) {
    it(`${w}x${h}`, () => {
      const js = heroLayout({ w, h }, { widthEm: TITLE_SIZE_EM.hero.width });
      const expected = cssHero(w, h);
      expect(js.fontPx).toBeCloseTo(expected.fontPx, 2);
      expect(js.left).toBeCloseTo(expected.left, 2);
      expect(js.bottom).toBeCloseTo(expected.bottom, 2);
    });
  }

  it("globals.css really uses the same constants (guards the CSS side of the parity)", () => {
    expect(css).toContain("--hero-margin: clamp(20px, 5vw, 72px)");
    expect(css).toContain("--hero-bottom: clamp(48px, 12svh, 120px)");
    expect(css).toContain(`min(11.5vw, 17svh, calc(62vw / ${TITLE_SIZE_EM.hero.width}))`);
    expect(css).toContain(`calc((100vw - 2 * var(--hero-margin)) / ${TITLE_SIZE_EM.hero.width})`);
    expect(css).toContain("@media (max-aspect-ratio: 9/10)");
    expect(css).toMatch(/clamp\(24px, min\(11\.5vw/);
  });
});
