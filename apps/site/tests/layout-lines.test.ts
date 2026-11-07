import { describe, expect, it } from "vitest";
import { layoutLines } from "../src/lib/title3d/layout-lines";

const width = (s: string) => s.length;

describe("layoutLines", () => {
  it("keeps explicit line breaks", () => {
    expect(layoutLines("SUA MARCA\nEM MOVIMENTO", 20, width)).toEqual(["SUA MARCA", "EM MOVIMENTO"]);
  });

  it("wraps by word when a line is wider than the limit", () => {
    expect(layoutLines("UMA LINHA MUITO LONGA AQUI", 12, width)).toEqual(["UMA LINHA", "MUITO LONGA", "AQUI"]);
  });

  it("leaves a single word wider than the limit on its own line instead of splitting it", () => {
    expect(layoutLines("ANTICONSTITUCIONAL OK", 8, width)).toEqual(["ANTICONSTITUCIONAL", "OK"]);
  });

  it("ignores extra spaces and returns nothing for empty text", () => {
    expect(layoutLines("  A   B  ", 10, width)).toEqual(["A B"]);
    expect(layoutLines("", 10, width)).toEqual([]);
  });
});
