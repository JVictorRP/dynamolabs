import { readFileSync } from "node:fs";
import { parse } from "opentype.js";
import { describe, expect, it } from "vitest";
import { COPY } from "../src/content/copy";
import { TITLE_SIZE_EM } from "../src/content/title-sizes";
import { blockHeightEm, layoutLines } from "../src/lib/title3d/layout-lines";

const buffer = readFileSync(new URL("../public/fonts/ArchivoBlack-Regular.ttf", import.meta.url));
const font = parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

/** O que o título 3D vai medir de verdade (mesma conta do createTitle3D). */
function measured(text: string) {
  const lines = layoutLines(text, 12, (s) => font.getAdvanceWidth(s, 1));
  return { width: Math.max(...lines.map((l) => font.getAdvanceWidth(l, 1))), height: blockHeightEm(lines.length) };
}

// O texto HTML nasce com estes tamanhos e depois o 3D mede os reais. Se divergirem, o layout salta (layout shift) na
// hora da troca. Este teste trava as constantes contra a fonte e a copy: mudou o texto, ele avisa para atualizar.
describe("TITLE_SIZE_EM equals what the 3D titles measure", () => {
  for (const [key, text] of [
    ["hero", COPY.hero.title],
    ["s2", COPY.s2.title],
    ["video2", COPY.video2.title],
  ] as const) {
    it(`${key}: "${text.replace(/\n/g, " / ")}"`, () => {
      const real = measured(text);
      expect(TITLE_SIZE_EM[key].width).toBeCloseTo(real.width, 3);
      expect(TITLE_SIZE_EM[key].height).toBeCloseTo(real.height, 6);
    });
  }
});
