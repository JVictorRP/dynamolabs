import { expect, test, type Page } from "@playwright/test";

// Regressões encontradas na revisão final: cada teste descreve o cenário que quebrava.

const heroTitle = (page: Page) => page.locator('[data-stage="hero-s2"] [data-title="hero"]');

test("the headline and the hero copy are on screen long before the 3D title is ready (slow font)", async ({ page }) => {
  await page.route("**/fonts/ArchivoBlack-Regular.ttf", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await route.continue();
  });
  await page.goto("/");
  // O título HTML aparece achatado e branco logo após a hidratação, sem esperar fonte, Three.js nem extrusão...
  await expect(heroTitle(page)).toHaveCSS("color", "rgb(255, 255, 255)", { timeout: 3000 });
  await expect(page.locator('[data-copy="hero"]')).toHaveCSS("opacity", "1", { timeout: 3000 });
  // ...e quando o 3D fica pronto o HTML se torna transparente (o 3D assume).
  await expect(heroTitle(page)).toHaveCSS("color", "rgba(0, 0, 0, 0)", { timeout: 20_000 });
});

test("if the title font fails to download, the text stays on screen and nothing throws", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/fonts/ArchivoBlack-Regular.ttf", (route) => route.abort());
  await page.goto("/");
  await page.waitForFunction(() => document.querySelector('[data-stage="hero-s2"] [data-renderer="webgl"]') !== null, undefined, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await expect(heroTitle(page)).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator('[data-copy="hero"]')).toHaveCSS("opacity", "1");
  expect(errors).toEqual([]);
});

test("a device without WebGL2 (but with canvas 2D) still gets the video and the text", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // Só WebGL1: o three recusa e o canvas 2D de reserva precisa continuar disponível.
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl2") return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...args) as never;
    } as typeof original;
  });
  await page.goto("/");
  await page.waitForSelector('[data-stage="hero-s2"] [data-renderer="canvas2d"]', { timeout: 15_000 });
  await expect(heroTitle(page)).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator('[data-copy="hero"]')).toHaveCSS("opacity", "1");
  expect(errors).toEqual([]);
});

test("the poster stays visible when the page is scrolled before the video can draw", async ({ page }) => {
  await page.route("**/frames/v1/manifest.json", () => {
    /* nunca responde: o palco não consegue começar */
  });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(600);
  const poster = page.locator("img.hero-poster");
  await expect(poster).toHaveCSS("opacity", "1");
  expect(await poster.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("the second video downloads nothing until the section is near", async ({ page }) => {
  const video2Requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/frames/v2/")) video2Requests.push(request.url());
  });
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__dynamo?.settle?.["hero-s2"]));
  await page.waitForTimeout(2500);
  expect(video2Requests).toEqual([]);
  await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="video2"]')!;
    window.scrollTo(0, wrapper.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5);
  });
  await expect.poll(() => video2Requests.length, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.__dynamo!.settle!.video2());
});

test("the Chatbot links land in the middle of the chat stage, not on its first black frame", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__dynamo?.progress["chat"] !== undefined);
  await page.locator('footer nav a[href="#chatbot"]').click();
  await page.waitForFunction(() => Math.abs((window.__dynamo?.progress["chat"] ?? -1) - 0.5) < 0.06, undefined, { timeout: 10_000 });
  await page.waitForTimeout(700);
  expect(await page.locator("#chatbot").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
  expect(await page.locator("[data-phone]").evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.95);
  expect(new URL(page.url()).hash).toBe("#chatbot");
});

test("opening the page already at /#chatbot also lands in the middle of the chat stage", async ({ page }) => {
  await page.goto("/#chatbot");
  await page.waitForFunction(() => Math.abs((window.__dynamo?.progress["chat"] ?? -1) - 0.5) < 0.06, undefined, { timeout: 10_000 });
});
