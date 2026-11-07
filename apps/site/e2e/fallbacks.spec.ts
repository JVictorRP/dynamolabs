import { expect, test } from "@playwright/test";

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("no stage is pinned: sections are static, the first and last frames are shown and there is one h1", async ({ page }) => {
    await page.goto("/");
    const vh = page.viewportSize()!.height;
    for (const wrapper of await page.locator("[data-stage]").all()) {
      expect(await wrapper.evaluate((el) => (el as HTMLElement).offsetHeight)).toBeLessThanOrEqual(vh + 2);
    }
    await expect(page.locator('img[src$="/frames/v1/desktop/0001.webp"]')).toBeVisible();
    await expect(page.locator('img[src$="/frames/v2/desktop/0121.webp"]')).toBeVisible(); // último frame do vídeo 2
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("[data-cta]")).toBeVisible();
  });
});

test.describe("no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page still has its title, the first frame and the call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.locator("h1:visible")).toContainText("SUA MARCA");
    await expect(page.locator('img[src$="/frames/v1/desktop/0001.webp"]')).toBeVisible();
    await expect(page.locator("[data-cta]")).toBeVisible();
  });

  // Regressão: sem JS o <form> (sem action) enviava por GET e punha nome, e-mail e telefone na URL.
  test("the contact form is not offered (it would submit by GET and leak personal data into the URL)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer form")).toBeHidden();
    await expect(page.getByText(/ative o JavaScript/i)).toBeVisible();
  });
});

test("rotating the phone in the middle of a stage causes no errors and almost no layout shift", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__dynamo?.settle?.["hero-s2"]));
  await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-stage="hero-s2"]')!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    window.scrollTo(0, wrapper.offsetTop + 0.6 * (wrapper.offsetHeight - sticky.offsetHeight));
  });
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(900);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThanOrEqual(0.01);
});
