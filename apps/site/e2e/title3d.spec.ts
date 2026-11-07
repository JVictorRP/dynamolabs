import { expect, test, type Page } from "@playwright/test";

const SHOWN = { rotX: 0, z: 0, opacity: 1, x: 0, y: 0 };
const HIDDEN = { ...SHOWN, opacity: 0 };

async function open(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/lab/title");
  await page.waitForFunction(() => Boolean(window.__labTitle));
  return errors;
}

const show = (page: Page, state: typeof SHOWN) => page.evaluate((s) => window.__labTitle!.setState(s), state);

test("renders an extruded title over the video frame without console errors", async ({ page }) => {
  const errors = await open(page);
  expect(await page.evaluate(() => window.__labTitle!.renderer)).toBe("webgl");
  const size = await page.evaluate(() => window.__labTitle!.size);
  expect(size.width).toBeGreaterThan(4); // "EM MOVIMENTO" tem mais de 4 em de largura
  expect(size.height).toBeGreaterThan(1.5); // duas linhas

  await show(page, SHOWN);
  const withTitle = await page.screenshot();
  await show(page, HIDDEN);
  const without = await page.screenshot();
  expect(withTitle.equals(without)).toBe(false);
  expect(errors).toEqual([]);
});

test("opacity and fold states change the render and hide the title at opacity 0", async ({ page }) => {
  await open(page);
  await show(page, SHOWN);
  const flat = await page.screenshot();
  await show(page, { ...SHOWN, opacity: 0.4 });
  const faded = await page.screenshot();
  await show(page, { ...SHOWN, rotX: -1.0, z: -1.5 });
  const folded = await page.screenshot();
  expect(flat.equals(faded)).toBe(false);
  expect(flat.equals(folded)).toBe(false);
  await show(page, HIDDEN);
  expect(await page.evaluate(() => window.__labTitle!.isVisible())).toBe(false);
  await show(page, SHOWN);
  expect(await page.evaluate(() => window.__labTitle!.isVisible())).toBe(true);
});
