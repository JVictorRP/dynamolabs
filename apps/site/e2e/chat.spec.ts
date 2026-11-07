import { expect, test, type Page } from "@playwright/test";
import { COPY } from "../src/content/copy";
import { CHAT_FROM, CHAT_TO, visibleChat } from "../src/lib/choreo/chat-script";
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

const viewportHeight = (page: Page) => page.viewportSize()!.height;
const chatBackground = (page: Page) => page.locator("#chatbot").evaluate((el) => getComputedStyle(el).backgroundColor);

test("the chat card is white, with the phone and the graphite menu, from the first scroll of its own stage", async ({ page }) => {
  await open(page);
  await goTo(page, 0);
  expect(await chatBackground(page)).toBe("rgb(255, 255, 255)");
  await expect(page.locator("header")).toHaveAttribute("data-logo", "grafite");
  const box = (await page.locator("[data-phone]").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight(page) + 1);
});

test("the phone already peeks from the bottom of the screen when section 2 finishes scrolling", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="hero-s2"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    window.scrollTo(0, wrapper.offsetTop + (wrapper.offsetHeight - sticky.offsetHeight));
  });
  await page.waitForFunction(() => (window.__dynamo?.progress["hero-s2"] ?? 0) > 0.995);
  await page.waitForTimeout(500);
  const h = viewportHeight(page);
  // Em tela horizontal o celular é o primeiro a aparecer; em tela vertical o texto da seção vem antes dele. Em ambas há conteúdo.
  const phone = (await page.locator("[data-phone]").boundingBox())!;
  const text = (await page.locator('#chatbot h2').boundingBox())!;
  expect(Math.min(phone.y, text.y)).toBeLessThan(h * 0.95);
  expect(phone.y).toBeGreaterThan(h * 0.5); // "ligeiramente": o grosso do celular ainda está abaixo da tela
  const cardTop = await page.locator('[data-stage="chat"]').evaluate((el) => el.getBoundingClientRect().top);
  expect(cardTop / h).toBeGreaterThan(0.6);
  expect(cardTop / h).toBeLessThan(0.85);
});

test("there is never an empty screen between section 2 and the chat: every scroll position shows text or the phone", async ({ page }) => {
  await open(page);
  const h = viewportHeight(page);
  const start = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="hero-s2"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    return wrapper.offsetTop + 0.85 * (wrapper.offsetHeight - sticky.offsetHeight);
  });
  const end = await page.evaluate(() => document.querySelector<HTMLElement>('[data-stage="chat"]')!.offsetTop + window.innerHeight * 0.4);
  const empty: number[] = [];
  for (let y = start; y <= end; y += (end - start) / 24) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(450);
    const shown = await page.evaluate(() => {
      const phone = document.querySelector<HTMLElement>("[data-phone]")!.getBoundingClientRect();
      const text = document.querySelector<HTMLElement>("#chatbot h2")!.getBoundingClientRect();
      const phoneOn = Math.min(phone.top, text.top) < window.innerHeight - 24;
      const s2 = [...document.querySelectorAll<HTMLElement>('[data-copy="s2"]')].some((e) => Number(getComputedStyle(e).opacity) > 0.4);
      const titles = window.__dynamo?.titles?.s2.opacity ?? 0;
      return phoneOn || s2 || titles > 0.4;
    });
    if (!shown) empty.push(Math.round(y));
  }
  expect(empty, `empty screens at scrollY (viewport ${h}px)`).toEqual([]);
});

test("in the middle the whole screen is white and the menu uses the graphite logo", async ({ page }) => {
  await open(page);
  await goTo(page, 0.5);
  expect(await chatBackground(page)).toBe("rgb(255, 255, 255)");
  await expect(page.locator("header")).toHaveAttribute("data-logo", "grafite");
  await expect(page.locator("header")).toHaveAttribute("data-variant", "light");
});

test("the closing video slides over the chat card from the bottom before the chat stage ends, and the menu turns dark when it reaches it", async ({ page }) => {
  await open(page);
  await goTo(page, 1);
  const h = viewportHeight(page);
  const top = await page.locator('[data-stage="video2"]').evaluate((el) => el.getBoundingClientRect().top);
  expect(top / h).toBeGreaterThan(0.6);
  expect(top / h).toBeLessThan(0.85);
  await expect(page.locator("header")).toHaveAttribute("data-logo", "grafite");
  await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="video2"]')!;
    window.scrollTo(0, wrapper.offsetTop + 2);
  });
  await page.waitForTimeout(700);
  await expect(page.locator("header")).toHaveAttribute("data-logo", "claro");
});

test("the number of bubbles on the phone follows the scroll (and reverses)", async ({ page }) => {
  await open(page);
  const bubbles = () => page.locator("[data-bubble]").count();
  // Pontos de conteúdo no MEIO de cada intervalo entre mensagens (chegam em 0,28 · 0,40 · 0,54 · 0,66 · 0,80): o progresso
  // é lido do layout em sub-pixels e oscila ~0,003, então um ponto colado num limiar daria resultado instável.
  for (const content of [0.2, 0.34, 0.47, 0.6, 0.73, 0.9, 0.47, 0.2]) {
    const p = CHAT_FROM + content * (CHAT_TO - CHAT_FROM);
    await goTo(page, p);
    const expected = visibleChat(COPY.chat.messages, content).shown.length;
    expect(await bubbles(), `bubbles at content progress ${content}`).toBe(expected);
  }
});

test("shows the typing indicator just before the bot answers", async ({ page }) => {
  await open(page);
  const bot = COPY.chat.messages.find((m) => m.from === "bot")!;
  const local = bot.at - 0.03; // dentro da janela de 0,06 antes da resposta
  await goTo(page, CHAT_FROM + local * (CHAT_TO - CHAT_FROM));
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
  expect(await chatBackground(page)).toBe("rgb(255, 255, 255)");
});
