import { expect, test, type Page } from "@playwright/test";
import { lumaStats } from "./helpers/pixels";

async function open(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__dynamo?.settle?.video2));
}

/** Rola até um progresso do palco do vídeo 2 e espera o progresso, os frames e o menu assentarem. */
async function goTo(page: Page, p: number) {
  await page.evaluate((target) => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="video2"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    window.scrollTo(0, wrapper.getBoundingClientRect().top + window.scrollY + target * (wrapper.offsetHeight - sticky.offsetHeight));
  }, p);
  await page.waitForFunction((target) => Math.abs((window.__dynamo?.progress["video2"] ?? -1) - target) < 0.005, p);
  await page.evaluate(() => window.__dynamo!.settle!.video2());
  await page.waitForTimeout(650);
}

const inViewport = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  const vp = page.viewportSize()!;
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1;
};

test("closing stage: the CTA appears at the end, in the viewport, set in Syncopate", async ({ page }) => {
  await open(page);
  await goTo(page, 0.5);
  expect(Number(await page.locator("[data-cta]").evaluate((el) => getComputedStyle(el).opacity))).toBe(0);
  await goTo(page, 0.92);
  expect(Number(await page.locator("[data-cta]").evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
  expect(await inViewport(page, "[data-cta]")).toBe(true);
  expect(await page.locator("[data-cta]").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/syncopate/i);
  await expect(page.locator("header")).toHaveAttribute("data-variant", "dark-glass");
  await expect(page.locator("header")).toHaveAttribute("data-logo", "claro");
});

test("the title sits on the left and the support text appears with the notification", async ({ page }) => {
  await open(page);
  await goTo(page, 0.4);
  const vp = page.viewportSize()!;
  const h2 = (await page.locator('[data-stage="video2"] [data-title="video2"]').boundingBox())!;
  expect(h2.x + h2.width / 2).toBeLessThan(vp.width * 0.6);
  expect(h2.y + h2.height).toBeLessThan(vp.height * 0.6);
  await goTo(page, 0.75);
  const support = page.locator('[data-stage="video2"] [data-copy="video2"]').nth(1);
  expect(Number(await support.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
});

test("keyboard: tabbing to the CTA while the stage is not reached scrolls the stage to its end", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.hasAttribute("data-cta"))) break;
  }
  expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-cta"))).toBe(true);
  await page.waitForFunction(() => (window.__dynamo?.progress["video2"] ?? 0) >= 0.85);
  await page.waitForTimeout(400);
  expect(await inViewport(page, "[data-cta]")).toBe(true);
});

test("title stays bright and readable over the real frame (scrims darken the video, not the text)", async ({ page }) => {
  await open(page);
  const h2 = '[data-stage="video2"] [data-title="video2"]';
  for (const p of [0.2, 0.5]) {
    await goTo(page, p);
    const box = (await page.locator(h2).boundingBox())!;
    const bright = await lumaStats(page, box, 0.97);
    console.log(`video2 title brightest 3% @${p}: ${bright.high.toFixed(2)}`);
    expect(bright.high, `title brightness at ${p}`).toBeGreaterThan(0.4);

    await page.evaluate(() => window.__dynamo!.debug!.hideText(true));
    await page.waitForTimeout(100);
    const behind = await lumaStats(page, box);
    await page.evaluate(() => window.__dynamo!.debug!.hideText(false));
    const ratio = 1.05 / (behind.mean + 0.05);
    console.log(`video2 contrast @${p}: ${ratio.toFixed(2)}:1`);
    expect(ratio, `contrast at ${p}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("footer: lockup, closing phrase, brand line and legal links; only configured contacts appear", async ({ page }) => {
  await open(page);
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.locator('img[src$="dynamo-lockup-claro.png"]')).toBeVisible();
  await expect(footer).toContainText("DYNAMO LABS · MARKETING COM IA E AUTOMAÇÃO");
  await expect(footer.locator('a[href="/privacidade"]')).toBeVisible();
  await expect(footer.locator('a[href="/termos"]')).toBeVisible();
  await expect(footer.locator("h2")).toContainText("CONVERSAR");
  // o build de teste configura só o WhatsApp: ele aparece; o e-mail, não configurado, não vira link fantasma
  expect(await footer.locator('a[href="https://wa.me/5500000000000"]').count()).toBe(1);
  expect(await footer.locator('a[href^="mailto:"]').count()).toBe(0);
});

// Regressão (vista nas capturas): a frase gigante estourava a coluna, cobrindo os links no desktop e saindo da tela no celular.
test("footer: the closing phrase fits on the screen and covers nothing", async ({ page }) => {
  await open(page);
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  const vp = page.viewportSize()!;
  const overflow = await footer.locator("h2").evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, right: el.getBoundingClientRect().left + el.scrollWidth }));
  expect(overflow.scroll, "the phrase must not overflow its own box").toBeLessThanOrEqual(overflow.client + 1);
  expect(overflow.right, "the phrase must end inside the viewport").toBeLessThanOrEqual(vp.width);
  const h2 = (await footer.locator("h2").boundingBox())!;
  for (const link of await footer.locator("nav a").all()) {
    const box = (await link.boundingBox())!;
    const overlaps = box.x < h2.x + h2.width && box.x + box.width > h2.x && box.y < h2.y + h2.height && box.y + box.height > h2.y;
    expect(overlaps, "footer links must not sit on top of the phrase").toBe(false);
  }
});

test("approved legal pages exist and no longer carry the provisional notice", async ({ page }) => {
  for (const path of ["/privacidade", "/termos"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
  }
});
