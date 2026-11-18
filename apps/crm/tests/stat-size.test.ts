import { describe, expect, it } from "vitest";
import { statFontSize } from "../src/lib/stat-size";

const cqw = (css: string) => Number(/([\d.]+)cqw/.exec(css)?.[1]);

describe("statFontSize", () => {
  it("keeps the big size for short numbers", () => {
    expect(statFontSize("12")).toContain("2.25rem");
  });
  it("shrinks with the length of the text so words fit inside the card", () => {
    expect(cqw(statFontSize("Conectado"))).toBeLessThan(cqw(statFontSize("12")));
    expect(cqw(statFontSize("Com problema"))).toBeLessThan(cqw(statFontSize("Conectado")));
  });
  it("never goes below a readable floor and survives empty text", () => {
    expect(statFontSize("x".repeat(80))).toContain("1.1rem");
    expect(statFontSize("")).toContain("2.25rem");
  });
});
