import { describe, expect, it } from "vitest";
import { getCopy } from "../src/content/copy/index";
import { getLegal } from "../src/content/legal/index";
import { LANGS, pathFor, type Lang } from "../src/lib/i18n/config";

/** Estrutura de um valor: objetos viram {chave: estrutura}, listas viram [estrutura do primeiro, tamanho], folhas viram o tipo. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return { list: value.map(shape) };
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

function leaves(value: unknown, path = ""): [string, unknown][] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, value]];
}

const others = LANGS.filter((l) => l !== "pt");

describe("copy has the same shape in every language", () => {
  for (const lang of others) {
    it(`${lang} mirrors pt (same keys, same list sizes, same types)`, () => {
      expect(shape(getCopy(lang))).toEqual(shape(getCopy("pt")));
    });
  }

  for (const lang of LANGS) {
    it(`${lang}: no empty text`, () => {
      for (const [path, value] of leaves(getCopy(lang))) {
        if (typeof value === "string") expect(value.trim(), path).not.toBe("");
      }
    });

    it(`${lang}: chat messages and cards keep the pt timing and speakers`, () => {
      const pt = getCopy("pt").chat;
      const copy = getCopy(lang).chat;
      expect(copy.messages.map((m) => [m.from, m.at])).toEqual(pt.messages.map((m) => [m.from, m.at]));
      expect(copy.cards.map((c) => c.at)).toEqual(pt.cards.map((c) => c.at));
    });

    it(`${lang}: each keyword is a whole word of its own title`, () => {
      const c = getCopy(lang);
      for (const key of ["hero", "s2", "video2"] as const) {
        const words = c[key].title.split(/\s+/);
        expect(words, `${key} title "${c[key].title}"`).toContain(c[key].keyword);
      }
    });

    it(`${lang}: titles keep the pt line count`, () => {
      const lines = (s: string) => s.split("\n").length;
      const c = getCopy(lang);
      expect([lines(c.hero.title), lines(c.s2.title), lines(c.chat.title), lines(c.video2.title)]).toEqual([2, 3, 3, 3]);
    });

    it(`${lang}: footer legal links point at the legal pages of this language`, () => {
      const hrefs = getCopy(lang).footer.legal.map((l) => l.href);
      expect(hrefs).toEqual([pathFor(lang, "privacy"), pathFor(lang, "terms")]);
    });

    it(`${lang}: in-page anchors are the same in every language`, () => {
      const c = getCopy(lang);
      expect(c.nav.links.map((l) => l.href)).toEqual(["#chatbot", "#contato"]);
      expect(c.nav.cta.href).toBe("#contato");
      expect(c.footer.nav.map((l) => l.href)).toEqual(["#chatbot", "#top"]);
    });
  }

  it("pins the titles decided in the plan", () => {
    const pinned: Record<Exclude<Lang, "pt">, Record<string, string>> = {
      en: { hero: "YOUR BRAND\nIN MOTION", s2: "AI DOES\nTHE HEAVY\nLIFTING", chat: "ANSWERS IN\nSECONDS, DAY\nAND NIGHT", video2: "YOUR NEXT\nCLIENT HAS\nARRIVED" },
      es: { hero: "TU MARCA\nEN MOVIMIENTO", s2: "LA IA HACE\nEL TRABAJO\nPESADO", chat: "RESPUESTA EN\nSEGUNDOS, DÍA\nY NOCHE", video2: "TU PRÓXIMO\nCLIENTE YA\nLLEGÓ" },
    };
    for (const lang of others) {
      const c = getCopy(lang);
      expect([c.hero.title, c.s2.title, c.chat.title, c.video2.title]).toEqual([pinned[lang].hero, pinned[lang].s2, pinned[lang].chat, pinned[lang].video2]);
    }
    expect([getCopy("en").hero.keyword, getCopy("en").s2.keyword, getCopy("en").video2.keyword]).toEqual(["MOTION", "HEAVY", "ARRIVED"]);
    expect([getCopy("es").hero.keyword, getCopy("es").s2.keyword, getCopy("es").video2.keyword]).toEqual(["MOVIMIENTO", "PESADO", "LLEGÓ"]);
  });

  it("keeps the approved Portuguese untouched", () => {
    const pt = getCopy("pt");
    expect(pt.hero.title).toBe("SUA MARCA\nEM MOVIMENTO");
    expect(pt.s2.title).toBe("IA FAZ\nO TRABALHO\nPESADO");
    expect(pt.video2.title).toBe("SEU PRÓXIMO\nCLIENTE JÁ\nCHEGOU");
    expect(pt.status).toBe("final");
  });

  it("en and es are approved (final) by the João Victor, in the copy and in the legal texts", () => {
    for (const lang of others) {
      expect(getCopy(lang).status).toBe("final");
      expect(getLegal(lang).status).toBe("final");
    }
  });
});

describe("legal texts have the same shape in every language", () => {
  for (const lang of others) {
    it(`${lang} mirrors pt`, () => {
      expect(shape(getLegal(lang))).toEqual(shape(getLegal("pt")));
    });
  }

  for (const lang of LANGS) {
    it(`${lang}: paragraphs are filled and pt is final`, () => {
      const legal = getLegal(lang);
      for (const [path, value] of leaves(legal)) {
        if (typeof value === "string") expect(value.trim(), path).not.toBe("");
      }
      expect(legal.privacy.paragraphs.length).toBe(getLegal("pt").privacy.paragraphs.length);
      expect(legal.terms.paragraphs.length).toBe(getLegal("pt").terms.paragraphs.length);
    });
  }

  it("pt legal is final (approved by the João Victor)", () => {
    expect(getLegal("pt").status).toBe("final");
  });
});
