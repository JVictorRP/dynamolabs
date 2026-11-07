import { expect, test, type Page } from "@playwright/test";

type Section = "hero-s2" | "wipe-in" | "chat" | "wipe-out" | "video2" | "footer";

async function setHeader(page: Page, section: Section, p: number) {
  await page.evaluate(([s, v]) => window.__labHeader!.set(s as Section, v as number), [section, p] as const);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/lab/header");
  await page.waitForFunction(() => Boolean(window.__labHeader));
});

test("uses the light logo file on dark sections and the graphite file on the white section", async ({ page }) => {
  await setHeader(page, "hero-s2", 0.1);
  await expect(page.locator("header")).toHaveAttribute("data-logo", "claro");
  await expect(page.locator('header img[data-active="true"]')).toHaveAttribute("src", /dynamo-simbolo-claro\.png$/);

  await setHeader(page, "chat", 0.5);
  await expect(page.locator("header")).toHaveAttribute("data-logo", "grafite");
  await expect(page.locator('header img[data-active="true"]')).toHaveAttribute("src", /dynamo-simbolo-grafite\.png$/);
});

test("never recolors the logo with CSS: no filter, mask or blend mode on the images", async ({ page }) => {
  for (const [section, p] of [["hero-s2", 0.1], ["chat", 0.5], ["video2", 0.2]] as const) {
    await setHeader(page, section, p);
    const styles = await page.locator("header img").evaluateAll((imgs) =>
      imgs.map((img) => {
        const cs = getComputedStyle(img);
        return { filter: cs.filter, mask: cs.maskImage, blend: cs.mixBlendMode };
      }),
    );
    for (const s of styles) expect(s).toEqual({ filter: "none", mask: "none", blend: "normal" });
  }
});

test("exposes the variant and drives the progress indicator from the video", async ({ page }) => {
  await setHeader(page, "hero-s2", 0.6);
  await expect(page.locator("header")).toHaveAttribute("data-variant", "compact");
  const scale = await page.locator("[data-indicator]").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
  expect(scale).toBeCloseTo(0.4286, 2);
});

test("keeps the header readable: dark text on the light variant, light text on dark ones", async ({ page }) => {
  const linkLuminance = () =>
    page.locator("header nav a").first().evaluate((el) => {
      const [r, g, b] = getComputedStyle(el).color.match(/\d+/g)!.map(Number);
      return (r + g + b) / 3;
    });
  // A cor anima (transição de 500 ms): espera chegar ao valor final em vez de ler no meio.
  await setHeader(page, "chat", 0.5);
  await expect.poll(linkLuminance).toBeLessThan(110); // grafite sobre fundo claro
  await setHeader(page, "video2", 0.2);
  await expect.poll(linkLuminance).toBeGreaterThan(200); // branco sobre fundo escuro
});

test("links show a visible focus ring for keyboard users", async ({ page }) => {
  await setHeader(page, "hero-s2", 0.1);
  await page.keyboard.press("Tab"); // primeiro foco: o logo
  await page.keyboard.press("Tab"); // primeiro link do menu
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement as Element);
    return { tag: document.activeElement?.tagName, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(ring.tag).toBe("A");
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThan(0);
});
