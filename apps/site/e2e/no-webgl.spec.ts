import { expect, test } from "@playwright/test";

// Sem WebGL: o Playwright só aceita `launchOptions` no nível do arquivo.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis", "--disable-gpu"] } });

test("falls back to the 2D canvas and shows the titles as flat HTML with CSS 3D", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-stage="hero-s2"] [data-renderer="canvas2d"]');
  const h1 = page.locator('[data-stage="hero-s2"] [data-title="hero"]');
  await expect(h1).toBeVisible();
  expect(await h1.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
  expect(await h1.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  expect(await h1.evaluate((el) => getComputedStyle(el).transform)).toMatch(/^(none|matrix3d\()/);
  // No meio da dobra do hero (progresso 0,35) o título HTML precisa estar mesmo inclinado em 3D, não parado.
  await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="hero-s2"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    window.scrollTo(0, wrapper.offsetTop + 0.35 * (wrapper.offsetHeight - sticky.offsetHeight));
  });
  await page.waitForFunction(() => Math.abs((window.__dynamo?.progress["hero-s2"] ?? -1) - 0.35) < 0.01);
  await page.waitForTimeout(300);
  expect(await h1.evaluate((el) => getComputedStyle(el).transform)).toMatch(/^matrix3d\(/);
  expect(await h1.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
});
