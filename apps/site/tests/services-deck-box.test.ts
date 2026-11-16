import { describe, expect, it } from "vitest";
import { servicesDeckBox } from "../src/components/HeroStage";

const VIEWPORTS: [string, number, number][] = [
  ["desktop 1440x900", 1440, 900],
  ["desktop 1920x1080", 1920, 1080],
  ["notebook 1280x720", 1280, 720],
  ["tablet retrato 820x1180", 820, 1180],
  ["celular 390x844", 390, 844],
  ["celular 360x640", 360, 640],
  ["celular deitado 800x360", 800, 360],
];

describe("servicesDeckBox: os cards ficam na metade de cima da tela", () => {
  for (const [name, w, h] of VIEWPORTS) {
    it(`${name}: começa perto do topo e não passa de 50% da altura`, () => {
      const box = servicesDeckBox({ w, h });
      expect(box.top, "começa abaixo do cabeçalho").toBeGreaterThanOrEqual(0.1 * h > 76 ? 0.1 * h : 76);
      expect(box.top, "começa no terço de cima").toBeLessThan(h / 3);
      expect(box.top + box.height, "termina até a metade da tela").toBeLessThanOrEqual(h / 2);
      expect(box.height).toBeGreaterThanOrEqual(0);
    });

    it(`${name}: cabe na largura e respeita a margem`, () => {
      const box = servicesDeckBox({ w, h });
      expect(box.left).toBeGreaterThanOrEqual(20);
      expect(box.left + box.width).toBeLessThanOrEqual(w - 20);
    });
  }

  it("em tela larga fica à esquerda e termina antes de 35% da largura (longe do título, que fica à direita, e do texto decorativo)", () => {
    const box = servicesDeckBox({ w: 1440, h: 900 });
    expect(box.left + box.width).toBeLessThanOrEqual(1440 * 0.35);
  });
});
