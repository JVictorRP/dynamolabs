import { describe, expect, it } from "vitest";
import { siteSection } from "../src/lib/choreo/site-section";

const at = (hero: number, chat: number, video2 = 0) => siteSection({ hero, chat, video2 });
const expectSection = (got: ReturnType<typeof at>, section: string, p: number) => {
  expect(got.section).toBe(section);
  expect(got.p).toBeCloseTo(p, 9); // aritmética de ponto flutuante: 0,925 − 0,85 não é exatamente 0,075
};

describe("siteSection (which section the menu is in, from the stages' progress)", () => {
  it("is the video stage until the chat stage starts", () => {
    expectSection(at(0.3, 0), "hero-s2", 0.3);
    expectSection(at(1, 0), "hero-s2", 1);
  });

  it("rises the white band over the first 15% of the chat stage", () => {
    expectSection(at(1, 0.075), "wipe-in", 0.5);
  });

  it("is the white chat section between 15% and 85%", () => {
    expectSection(at(1, 0.5), "chat", 0.5);
    expectSection(at(1, 0.15), "chat", 0);
    expectSection(at(1, 0.85), "chat", 1);
  });

  it("leaves over the last 15% and stays in the wipe-out until the next stage starts", () => {
    expectSection(at(1, 0.925), "wipe-out", 0.5);
    expectSection(at(1, 1), "wipe-out", 1);
  });

  it("is the second video stage once it has started", () => {
    expectSection(at(1, 1, 0.2), "video2", 0.2);
  });
});
