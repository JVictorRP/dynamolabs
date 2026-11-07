import { expect, test } from "@playwright/test";

// Ajustes pedidos depois da primeira revisão visual: títulos menores e planos, sobrancelhas pequenas e bem espaçadas.

test("every eyebrow is small and widely letter-spaced", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__dynamo?.progress["chat"] !== undefined));
  const eyebrows = await page.locator(".eyebrow").evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      return { size: parseFloat(cs.fontSize), spacing: parseFloat(cs.letterSpacing) };
    }),
  );
  expect(eyebrows.length).toBeGreaterThanOrEqual(3); // hero, seção 2, chat e vídeo 2
  for (const e of eyebrows) {
    expect(e.size).toBeLessThanOrEqual(12.01);
    expect(e.size).toBeGreaterThanOrEqual(10);
    expect(e.spacing / e.size).toBeGreaterThanOrEqual(0.55); // 0,6 em
  }
});

test("the hero title is smaller: at most 46% of the width on a landscape screen", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "medida em tela horizontal");
  await page.goto("/");
  await page.waitForSelector('[data-title="hero"]');
  const { width, vw } = await page.locator('[data-title="hero"]').evaluate((el) => ({ width: el.scrollWidth, vw: window.innerWidth }));
  expect(width / vw).toBeLessThanOrEqual(0.46);
  const fs = await page.locator('[data-title="hero"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs).toBeLessThanOrEqual(92.01);
});

test("the chat title has no fake extrusion (no text-shadow) and is smaller", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-stage="chat"] h2');
  const { shadow, size, vw } = await page.locator('[data-stage="chat"] h2').evaluate((el) => ({ shadow: getComputedStyle(el).textShadow, size: parseFloat(getComputedStyle(el).fontSize), vw: window.innerWidth }));
  expect(shadow).toBe("none");
  expect(size).toBeLessThanOrEqual(Math.max(22, 0.038 * vw) + 0.01);
});
