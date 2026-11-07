import { expect, test, type Page } from "@playwright/test";
import { COPY } from "../src/content/copy";
import { visibleChat } from "../src/lib/choreo/chat-script";
import { WIPE_ZONE } from "../src/lib/choreo/site-section";
import { segment } from "../src/lib/scroll/math";

async function open(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(document.querySelector('[data-stage="chat"]')) && window.__dynamo?.progress["chat"] !== undefined);
}

/** Rola até um progresso do palco do chat e espera o progresso assentar e a transição do menu terminar. */
async function goTo(page: Page, p: number) {
  await page.evaluate((target) => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="chat"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    window.scrollTo(0, wrapper.offsetTop + target * (wrapper.offsetHeight - sticky.offsetHeight));
  }, p);
  await page.waitForFunction((target) => Math.abs((window.__dynamo?.progress["chat"] ?? -1) - target) < 0.005, p);
  await page.waitForTimeout(650);
}

const wipeFraction = (page: Page) =>
  page.locator("[data-wipe]").evaluate((el) => el.getBoundingClientRect().height / window.innerHeight);

test("the stage starts dark and the white band rises over the first 15%", async ({ page }) => {
  await open(page);
  await goTo(page, 0.01);
  expect(await wipeFraction(page)).toBeLessThan(0.15);
  await expect(page.locator("header")).toHaveAttribute("data-logo", "claro");
  await goTo(page, WIPE_ZONE / 2);
  expect(await wipeFraction(page)).toBeCloseTo(0.5, 1);
});

test("in the middle the whole screen is white and the menu uses the graphite logo", async ({ page }) => {
  await open(page);
  await goTo(page, 0.5);
  expect(await wipeFraction(page)).toBeCloseTo(1, 2);
  await expect(page.locator("header")).toHaveAttribute("data-logo", "grafite");
  await expect(page.locator("header")).toHaveAttribute("data-variant", "light");
});

test("the white band leaves from the top over the last 15% and the menu turns dark first", async ({ page }) => {
  await open(page);
  await goTo(page, 1 - WIPE_ZONE / 2);
  expect(await wipeFraction(page)).toBeCloseTo(0.5, 1);
  await expect(page.locator("header")).toHaveAttribute("data-logo", "claro");
});

test("the number of bubbles on the phone follows the scroll (and reverses)", async ({ page }) => {
  await open(page);
  const bubbles = () => page.locator("[data-bubble]").count();
  // Pontos de conteúdo no MEIO de cada intervalo entre mensagens (chegam em 0,28 · 0,40 · 0,54 · 0,66 · 0,80): o progresso
  // é lido do layout em sub-pixels e oscila ~0,003, então um ponto colado num limiar daria resultado instável.
  for (const content of [0.2, 0.34, 0.47, 0.6, 0.73, 0.9, 0.47, 0.2]) {
    const p = WIPE_ZONE + content * (1 - 2 * WIPE_ZONE);
    await goTo(page, p);
    const expected = visibleChat(COPY.chat.messages, content).shown.length;
    expect(await bubbles(), `bubbles at content progress ${content}`).toBe(expected);
  }
});

test("shows the typing indicator just before the bot answers", async ({ page }) => {
  await open(page);
  const bot = COPY.chat.messages.find((m) => m.from === "bot")!;
  const local = bot.at - 0.03; // dentro da janela de 0,06 antes da resposta
  await goTo(page, WIPE_ZONE + local * (1 - 2 * WIPE_ZONE));
  await expect(page.locator("[data-typing]")).toHaveCount(1);
  await goTo(page, 0.5);
  await expect(page.locator("[data-typing]")).toHaveCount(0);
});

test("the phone always fits inside the viewport", async ({ page }) => {
  await open(page);
  await goTo(page, 0.5);
  const vp = page.viewportSize()!;
  const box = (await page.locator("[data-phone]").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
});

test("with reduced motion there is no pin: the section is white and the full conversation is visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForSelector('[data-stage="chat"] [data-bubble]');
  expect(await page.locator("[data-bubble]").count()).toBe(COPY.chat.messages.length);
  const wrapperHeight = await page.locator('[data-stage="chat"]').evaluate((el) => (el as HTMLElement).offsetHeight);
  expect(wrapperHeight).toBeLessThanOrEqual(page.viewportSize()!.height + 2);
  await page.locator('[data-stage="chat"]').scrollIntoViewIfNeeded();
  expect(await wipeFraction(page)).toBeCloseTo(1, 2);
});
