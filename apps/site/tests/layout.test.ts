import { describe, expect, it } from "vitest";
import { blockPlacement, heroLayout, s2Layout } from "../src/lib/stage/layout";
import { unitsPerPx } from "../src/lib/stage/camera";
import { blockHeightEm, wordIndexOf } from "../src/lib/title3d/layout-lines";

describe("heroLayout (title anchored bottom-left, never wider than its share of the screen)", () => {
  const block = { widthEm: 8.9 }; // largura medida de "EM MOVIMENTO" na Archivo Black

  it("on desktop the title takes at most 62% of the width, so it stays clear of the lit logo", () => {
    const l = heroLayout({ w: 1440, h: 900 }, block);
    expect(l.fontPx).toBeCloseTo((0.62 * 1440) / 8.9, 2);
    expect(l.fontPx * block.widthEm).toBeLessThanOrEqual(0.62 * 1440 + 0.01);
    expect(l.left).toBe(72);
    expect(l.bottom).toBe(108);
  });

  it("on a portrait phone the title never runs past the right margin, even at the minimum size", () => {
    const l = heroLayout({ w: 390, h: 844 }, block);
    expect(l.left).toBe(20);
    expect(l.bottom).toBeCloseTo(101.28, 2);
    expect(l.left + l.fontPx * block.widthEm).toBeLessThanOrEqual(390 - 20 + 0.01);
  });

  it("is capped at 128px on very large screens", () => {
    expect(heroLayout({ w: 3000, h: 1800 }, { widthEm: 4 }).fontPx).toBe(128);
  });
});

describe("s2Layout (title on the right, away from the notebook)", () => {
  const block = { widthEm: 7.7, heightEm: 2.52 };

  it("sits in the upper right on a landscape screen: inside the right half, above 45% of the height, aligned right", () => {
    const l = s2Layout({ w: 1440, h: 900 }, block);
    expect(l.fontPx).toBeCloseTo(0.085 * 900, 2);
    expect(l.left).toBeGreaterThanOrEqual(720 - 0.01);
    expect(l.left + l.fontPx * block.widthEm).toBeCloseTo(1440 - 72, 2);
    expect(l.bottom).toBeCloseTo(0.74 * 900 - (2.52 * l.fontPx) / 2, 2); // centro a 26% do topo
    expect(l.bottom).toBeGreaterThanOrEqual(0.55 * 900); // o bloco termina acima de 45% da altura, onde o caderno ainda não chegou
  });

  it("moves up to the top third on a portrait phone, leaving the notebook free", () => {
    const l = s2Layout({ w: 390, h: 844 }, block);
    expect(l.fontPx).toBe(32);
    expect(l.left).toBeCloseTo(390 - 20 - 7.7 * 32, 2);
    expect(l.bottom).toBeCloseTo(844 * 0.7 - (2.52 * 32) / 2, 2);
  });
});

describe("blockPlacement (px layout → scene units)", () => {
  it("converts the hero layout into scale and position on the z=0 plane", () => {
    const vp = { w: 1440, h: 900 };
    const layout = heroLayout(vp, { widthEm: 8.9 });
    const hero = blockPlacement(layout, blockHeightEm(2), vp);
    expect(unitsPerPx(900)).toBeCloseTo(0.004204, 5);
    expect(hero.scale).toBeCloseTo(layout.fontPx * 0.004204, 3);
    expect(hero.x).toBeCloseTo((72 - 720) * 0.004204, 3);
    expect(hero.y).toBeCloseTo((108 + (1.62 * layout.fontPx) / 2 - 450) * 0.004204, 3);
  });
});

describe("title helpers", () => {
  it("computes a block's height in em from its line count (0.9 line height + 0.72 cap)", () => {
    expect(blockHeightEm(1)).toBeCloseTo(0.72, 6);
    expect(blockHeightEm(3)).toBeCloseTo(2.52, 6);
  });

  it("finds a keyword's word index across the whole text", () => {
    expect(wordIndexOf("SUA MARCA\nEM MOVIMENTO", "MOVIMENTO")).toBe(3);
    expect(wordIndexOf("IA FAZ\nO TRABALHO\nPESADO", "PESADO")).toBe(4);
    expect(wordIndexOf("SUA MARCA", "NADA")).toBe(-1);
  });
});
