import { readFileSync } from "node:fs";
import { parse } from "opentype.js";
import { describe, expect, it } from "vitest";
import { getCopy } from "../src/content/copy/index";
import { TITLE_SIZE_EM } from "../src/content/title-sizes";
import { LANGS } from "../src/lib/i18n/config";
import { blockHeightEm, layoutLines } from "../src/lib/title3d/layout-lines";

const buffer = readFileSync(new URL("../public/fonts/ArchivoBlack-Regular.ttf", import.meta.url));
const font = parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

/** O que o título 3D vai medir de verdade (mesma conta do createTitle3D). */
function measured(text: string) {
  const lines = layoutLines(text, 12, (s) => font.getAdvanceWidth(s, 1));
  return { width: Math.max(...lines.map((l) => font.getAdvanceWidth(l, 1))), height: blockHeightEm(lines.length), lines: lines.length };
}

const KEYS = ["hero", "s2", "video2"] as const;

// O texto HTML nasce com estes tamanhos e depois o 3D mede os reais. Se divergirem, o layout salta (layout shift) na
// hora da troca. Este teste trava as constantes contra a fonte e a copy de cada idioma: mudou o texto, ele avisa.
describe("TITLE_SIZE_EM equals what the 3D titles measure, in every language", () => {
  for (const lang of LANGS) {
    for (const key of KEYS) {
      const text = getCopy(lang)[key].title;
      it(`${lang} ${key}: "${text.replace(/\n/g, " / ")}"`, () => {
        const real = measured(text);
        expect(TITLE_SIZE_EM[lang][key].width).toBeCloseTo(real.width, 3);
        expect(TITLE_SIZE_EM[lang][key].height).toBeCloseTo(real.height, 6);
      });
    }
  }
});

// O layout foi desenhado para o português: as traduções mantêm as linhas e não passam de 15% a mais na linha mais larga.
describe("translated titles fit the layout designed for Portuguese", () => {
  for (const lang of LANGS.filter((l) => l !== "pt")) {
    for (const key of KEYS) {
      it(`${lang} ${key}: same number of lines and at most 15% wider than pt`, () => {
        const pt = measured(getCopy("pt")[key].title);
        const tr = measured(getCopy(lang)[key].title);
        expect(tr.lines).toBe(pt.lines);
        expect(tr.width, `${tr.width.toFixed(3)} em vs pt ${pt.width.toFixed(3)} em`).toBeLessThanOrEqual(pt.width * 1.15);
      });
    }
  }
});
