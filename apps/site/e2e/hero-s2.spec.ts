import { expect, test, type Page } from "@playwright/test";
import { heroTitleState, s2TitleState } from "../src/lib/choreo/title-motion";

async function open(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__dynamo?.settle?.["hero-s2"]));
}

/** Rola até um progresso do palco 1, espera o progresso e os frames assentarem e a transição do menu terminar. */
async function goTo(page: Page, p: number) {
  await page.evaluate((target) => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="hero-s2"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    window.scrollTo(0, wrapper.offsetTop + target * (wrapper.offsetHeight - sticky.offsetHeight));
  }, p);
  await page.waitForFunction((target) => Math.abs((window.__dynamo?.progress["hero-s2"] ?? -1) - target) < 0.005, p);
  await page.evaluate(() => window.__dynamo!.settle!["hero-s2"]());
  await page.waitForTimeout(650);
}

const center = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const opacityOf = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).opacity)));

test("hero: the real h1 is in the DOM at the bottom-left and the 3D canvas is decorative", async ({ page }) => {
  await open(page);
  await goTo(page, 0.05);
  await expect(page.locator('[data-stage="hero-s2"] h1')).toContainText("SUA MARCA");
  await expect(page.locator('[data-stage="hero-s2"] canvas')).toHaveAttribute("aria-hidden", "true");
  const vp = page.viewportSize()!;
  const c = await center(page, '[data-stage="hero-s2"] [data-title="hero"]');
  expect(c.x).toBeLessThan(vp.width / 2);
  expect(c.y).toBeGreaterThan(vp.height / 2);
});

test("section 2: the title sits on the right half, away from the notebook, and the hero copy is gone", async ({ page }) => {
  await open(page);
  await goTo(page, 0.7);
  const vp = page.viewportSize()!;
  expect((await center(page, '[data-stage="hero-s2"] [data-title="s2"]')).x).toBeGreaterThan(vp.width * 0.55);
  for (const o of await opacityOf(page, '[data-copy="hero"]')) expect(o).toBe(0);
  const progress = await page.evaluate(() => window.__dynamo!.progress["hero-s2"]);
  const titles = await page.evaluate(() => window.__dynamo!.titles!);
  expect(titles.hero.opacity).toBeCloseTo(heroTitleState(progress).opacity, 3);
  expect(titles.s2.opacity).toBeCloseTo(s2TitleState(progress).opacity, 3);
  expect(titles.s2.opacity).toBeCloseTo(0.85, 3);
});

test("at 95% the hero block is gone and section 2 is still on screen (the chat card is sliding in under it, no empty screen)", async ({ page }) => {
  await open(page);
  await goTo(page, 0.95);
  for (const o of await opacityOf(page, '[data-copy="hero"], [data-copy="cue"]')) expect(o).toBe(0);
  for (const o of await opacityOf(page, '[data-copy="s2"]')) expect(o).toBe(1);
  const titles = await page.evaluate(() => window.__dynamo!.titles!);
  expect(titles.hero.opacity).toBe(0);
  expect(titles.s2.opacity).toBeCloseTo(0.85, 3);
});

/** Diferença média absoluta por canal (0–255) entre duas capturas PNG, medida dentro do navegador. */
async function meanAbsDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ([x, y]) => {
    const load = async (b64: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const [da, db] = [await load(x), await load(y)];
    let sum = 0;
    let n = 0;
    for (let i = 0; i < da.length; i += 4 * 7) {
      for (let c = 0; c < 3; c++) sum += Math.abs(da[i + c] - db[i + c]);
      n += 3;
    }
    return sum / n;
  }, [a.toString("base64"), b.toString("base64")] as const);
}

// O progresso mede a posição do contêiner em sub-pixels: a mesma rolagem pode dar 0,7000 ou 0,6998, o que muda a
// mistura entre dois frames em ~0,03 (1–2 níveis de cor). A tolerância absorve isso; um frame ou título errado daria >> 5.
test("is reversible: 0.7 → 0.05 → 0.7 reproduces the same image (within sub-pixel noise)", async ({ page }) => {
  await open(page);
  await goTo(page, 0.7);
  const first = await page.screenshot();
  await goTo(page, 0.05);
  const elsewhere = await page.screenshot();
  await goTo(page, 0.7);
  const again = await page.screenshot();
  expect(await meanAbsDiff(page, first, again)).toBeLessThan(0.5);
  expect(await meanAbsDiff(page, first, elsewhere)).toBeGreaterThan(5); // a medida distingue de verdade dois estados
});

/** Pixels mais claros dentro de uma caixa da página, medidos numa captura (luminância relativa, percentil dado). */
async function brightestPixels(page: Page, rect: { x: number; y: number; width: number; height: number }, percentile: number): Promise<number> {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ b64, r, q }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const k = img.naturalWidth / window.innerWidth;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.width * k), Math.round(r.height * k));
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const ys: number[] = [];
      for (let i = 0; i < data.length; i += 8) ys.push(0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]));
      ys.sort((a, b) => a - b);
      return ys[Math.min(ys.length - 1, Math.floor(ys.length * q))];
    },
    { b64: shot, r: rect, q: percentile },
  );
}

// Regressão: os scrims pretos ficavam por cima do canvas e escureciam os títulos 3D (saíam cinza). O título
// branco precisa continuar com pixels quase brancos; o da seção 2 (85% de opacidade) também.
test("titles keep their brightness: the scrims darken the video, not the text", async ({ page }) => {
  await open(page);
  for (const [p, selector, min] of [[0, '[data-stage="hero-s2"] [data-title="hero"]', 0.6], [0.7, '[data-stage="hero-s2"] [data-title="s2"]', 0.35]] as const) {
    await goTo(page, p);
    const box = (await page.locator(selector).boundingBox())!;
    const y = await brightestPixels(page, box, 0.97);
    console.log(`brightest 3% @${p} ${selector}: ${y.toFixed(2)}`);
    expect(y, `title brightness at progress ${p}`).toBeGreaterThan(min);
  }
});

/** Contraste do texto branco com o que está atrás dele: luminância média do frame (sem o texto) dentro do bloco. */
test("keeps white text readable: the area behind each title has contrast >= 4.5:1 with white", async ({ page }) => {
  await open(page);
  const h1 = '[data-stage="hero-s2"] [data-title="hero"]';
  const h2 = '[data-stage="hero-s2"] [data-title="s2"]';
  const checkpoints: Array<[number, string]> = [[0, h1], [0.15, h1], [0.25, h1], [0.6, h2], [0.7, h2], [0.8, h2]];
  for (const [p, selector] of checkpoints) {
    await goTo(page, p);
    await page.evaluate(() => window.__dynamo!.debug!.hideText(true));
    await page.waitForTimeout(100);
    const box = (await page.locator(selector).boundingBox())!;
    const shot = (await page.screenshot()).toString("base64");
    await page.evaluate(() => window.__dynamo!.debug!.hideText(false));
    const y = await page.evaluate(
      async ({ b64, rect }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const k = img.naturalWidth / window.innerWidth;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(Math.round(rect.x * k), Math.round(rect.y * k), Math.round(rect.width * k), Math.round(rect.height * k));
        const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        let sum = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 16) {
          sum += 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
          n++;
        }
        return sum / n;
      },
      { b64: shot, rect: box },
    );
    const ratio = 1.05 / (y + 0.05);
    console.log(`contrast @${p} ${selector}: ${ratio.toFixed(2)}:1`);
    expect(ratio, `contrast at progress ${p}`).toBeGreaterThanOrEqual(4.5);
  }
});
