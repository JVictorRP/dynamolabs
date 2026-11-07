import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, query = "") {
  await page.goto(`/lab/stage${query}`);
  await page.waitForFunction(() => Boolean(window.__lab));
}

/** Põe o palco em um progresso, espera os frames chegarem e devolve a captura da tela. */
async function shot(page: Page, p: number): Promise<Buffer> {
  await page.evaluate(async (progress) => {
    window.__lab!.setProgress(progress);
    await window.__lab!.settled();
  }, p);
  return page.screenshot();
}

test("draws different frames at different progress values and is not blank", async ({ page }) => {
  await open(page);
  const [a, b, c] = [await shot(page, 0), await shot(page, 0.5), await shot(page, 1)];
  expect(a.equals(b)).toBe(false);
  expect(b.equals(c)).toBe(false);
  expect(a.equals(c)).toBe(false);
  expect(b.length).toBeGreaterThan(20_000); // um frame real comprime muito mais que um preto liso
});

test("is reversible: 0.5 → 0 → 0.5 reproduces the same image", async ({ page }) => {
  await open(page);
  const first = await shot(page, 0.5);
  await shot(page, 0);
  const again = await shot(page, 0.5);
  expect(again.equals(first)).toBe(true);
});

test("uses WebGL by default and the 2D canvas fallback on request", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.__lab!.renderer)).toBe("webgl");
  await open(page, "?canvas2d");
  expect(await page.evaluate(() => window.__lab!.renderer)).toBe("canvas2d");
  const a = await shot(page, 0.1);
  const b = await shot(page, 0.9);
  expect(a.equals(b)).toBe(false);
});

test("resize and rotation keep the canvas covering the viewport with a valid crop", async ({ page }) => {
  await open(page);
  for (const [w, h] of [[1280, 720], [390, 844], [844, 390]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await shot(page, 0.3);
    const box = await page.locator("canvas").boundingBox();
    expect(box?.width).toBeCloseTo(w, 0);
    expect(box?.height).toBeCloseTo(h, 0);
    const crop = await page.evaluate(() => window.__lab!.lastDraw()!.crop);
    expect(crop.sw / crop.sh).toBeCloseTo(w / h, 1);
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
  }
});
