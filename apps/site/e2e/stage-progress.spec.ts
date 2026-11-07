import { expect, test, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/lab/pinned");
  await page.waitForFunction(() => Boolean(window.__lab));
}

/** Rola o documento até um progresso do palco e espera o progresso suavizado chegar lá. */
async function scrollToProgress(page: Page, p: number) {
  await page.evaluate((target) => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="hero-s2"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    const range = wrapper.offsetHeight - sticky.offsetHeight;
    window.scrollTo(0, wrapper.offsetTop + target * range);
  }, p);
  await page.waitForFunction((target) => Math.abs((window.__dynamo?.progress["hero-s2"] ?? -1) - target) < 0.01, p);
}

const progress = (page: Page) => page.evaluate(() => window.__dynamo!.progress["hero-s2"]);

test("tracks scroll inside the pinned stage and mirrors it in a CSS variable", async ({ page }) => {
  await open(page);
  await scrollToProgress(page, 0.5);
  expect(await progress(page)).toBeCloseTo(0.5, 1);
  const css = await page.locator('[data-stage="hero-s2"]').evaluate((el) => (el as HTMLElement).style.getPropertyValue("--p-hero-s2"));
  expect(Number(css)).toBeCloseTo(0.5, 1);
});

test("keeps the stage pinned: the sticky box stays in the viewport while progressing", async ({ page }) => {
  await open(page);
  await scrollToProgress(page, 0.5);
  const top = await page.locator("[data-sticky]").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThan(1);
});

test("reload in the middle of the stage shows the right frame at once, never passing through 0", async ({ page }) => {
  await open(page);
  await scrollToProgress(page, 0.5);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__lab));
  await page.evaluate(() => window.__lab!.settled());
  const { history, index } = await page.evaluate(() => ({ history: window.__dynamo!.history, index: window.__lab!.lastDraw()!.index }));
  expect(Math.min(...history)).toBeGreaterThan(0.45);
  expect(index).toBeGreaterThan(55);
  expect(index).toBeLessThan(63);
});

test("back navigation restores the position", async ({ page }) => {
  await open(page);
  await scrollToProgress(page, 0.5);
  await page.goto("/lab/stage");
  await page.goBack();
  await page.waitForFunction(() => Boolean(window.__lab));
  await page.waitForFunction(() => Math.abs((window.__dynamo?.progress["hero-s2"] ?? -1) - 0.5) < 0.03);
});

/** Espera a rolagem parar (a posição não muda por ~400 ms). O Chromium às vezes descarta uma tecla apertada
 *  ao final de uma rolagem animada, mesmo numa página sem código nosso. */
async function scrollIdle(page: Page) {
  let previous = -1;
  let stable = 0;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      stable = y === previous ? stable + 1 : 0;
      previous = y;
      return stable;
    }, { intervals: [100] })
    .toBeGreaterThanOrEqual(4);
}

test("End and Home keys jump to the end and the start of the stage", async ({ page }) => {
  await open(page);
  const scrollY = () => page.evaluate(() => window.scrollY);
  await page.keyboard.press("End");
  await expect.poll(scrollY, { message: "End should scroll the document" }).toBeGreaterThan(1000);
  await page.waitForFunction(() => (window.__dynamo?.progress["hero-s2"] ?? 0) > 0.99);
  await scrollIdle(page);
  await page.keyboard.press("Home");
  await expect.poll(scrollY, { message: "Home should scroll back to the top" }).toBeLessThan(5);
  await page.waitForFunction(() => (window.__dynamo?.progress["hero-s2"] ?? 1) < 0.01);
});

test("resizing recomputes the stage from the new layout", async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await scrollToProgress(page, 0.5);
  expect(await progress(page)).toBeCloseTo(0.5, 1);
  const stickyHeight = await page.locator("[data-sticky]").evaluate((el) => el.getBoundingClientRect().height);
  expect(stickyHeight).toBeCloseTo(844, 0);
});
