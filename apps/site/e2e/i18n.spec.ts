import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { getCopy } from "../src/content/copy/index";
import { getLegal } from "../src/content/legal/index";
import { HTML_LANG, LANGS, pathFor, type Lang } from "../src/lib/i18n/config";

// O build do e2e (NEXT_PUBLIC_E2E=1) publica os três idiomas, mesmo com en e es ainda provisórios.

async function open(page: Page, lang: Lang) {
  await page.goto(pathFor(lang, "home"));
  await page.waitForFunction(() => Boolean(window.__dynamo?.settle?.video2) && window.__dynamo?.progress["chat"] !== undefined);
}

for (const lang of LANGS) {
  const copy = getCopy(lang);

  test.describe(`language ${lang}`, () => {
    test("the document, the headline, the skip link and the footer speak the language", async ({ page }) => {
      const errors: string[] = [];
      const bad: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
      await open(page, lang);

      expect(await page.locator("html").getAttribute("lang")).toBe(HTML_LANG[lang]);
      expect((await page.locator("h1").first().textContent())?.replace(/\s+/g, " ").trim()).toBe(copy.hero.title.replace(/\n/g, " "));
      await expect(page).toHaveTitle(copy.meta.title);
      await expect(page.locator('a[href="#top"]').first()).toHaveText(copy.skip);
      expect((await page.locator("footer h2").textContent())?.replace(/\s+/g, "")).toBe(copy.footer.phrase.replace(/\s+/g, ""));
      expect(errors, "console errors").toEqual([]);
      expect(bad, "failed responses").toEqual([]);
    });

    test("the contact form has labels and validation messages in the language", async ({ page }) => {
      await open(page, lang);
      await page.locator("footer").scrollIntoViewIfNeeded();
      await expect(page.getByLabel(copy.contact.name, { exact: false }).first()).toBeVisible();
      await page.getByRole("button", { name: copy.contact.submit }).click();
      await expect(page.getByText(copy.contact.errors.name)).toBeVisible();
    });

    test("the in-page anchors #chatbot and #contato lead to their sections", async ({ page }) => {
      await open(page, lang);
      // O botão de contato (o link de texto do menu fica escondido no celular).
      await page.locator("header a.bg-teal").click();
      await expect(page.locator("footer#contato")).toBeInViewport();
      await page.goto(`${pathFor(lang, "home")}#chatbot`);
      await page.waitForFunction(() => window.__dynamo?.progress["chat"] !== undefined);
      await page.waitForFunction(() => (window.__dynamo?.progress["chat"] ?? 0) > 0.2);
      await expect(page.locator("#chatbot")).toBeInViewport();
    });

    test("the head declares canonical, hreflang for every language and the Open Graph locale", async ({ page }) => {
      await page.goto(pathFor(lang, "home"));
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical).toBe(`https://dynamo.business${pathFor(lang, "home") === "/" ? "" : pathFor(lang, "home")}`);
      const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) => els.map((e) => [e.getAttribute("hreflang"), e.getAttribute("href")]));
      expect(alternates.map((a) => a[0]).sort()).toEqual(["en", "es", "pt-BR", "x-default"]);
      expect(await page.locator('meta[property="og:locale"]').getAttribute("content")).toBe({ pt: "pt_BR", en: "en_US", es: "es_ES" }[lang]);
      const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
      expect(ld.description).toBe(copy.meta.description);
    });

    test("without JavaScript the static version shows the headline in the language", async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(pathFor(lang, "home"));
      expect((await page.locator("h1").first().textContent())?.replace(/\s+/g, " ").trim()).toBe(copy.hero.title.replace(/\n/g, " "));
      await expect(page.getByText(copy.chat.eyebrow).first()).toBeAttached();
      await context.close();
    });

    test("with reduced motion the static sections come out in the language", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(pathFor(lang, "home"));
      await expect(page.locator("[data-static]").first()).toBeVisible();
      await expect(page.getByText(copy.video2.cta)).toBeVisible();
      await context.close();
    });

    test("the legal pages exist, are in the language and keep the language switcher pointing at the same page", async ({ page }) => {
      const legal = getLegal(lang);
      for (const [key, text] of [["privacy", legal.privacy], ["terms", legal.terms]] as const) {
        await page.goto(pathFor(lang, key));
        expect(await page.locator("html").getAttribute("lang")).toBe(HTML_LANG[lang]);
        await expect(page.locator("h1")).toHaveText(text.title);
        await expect(page).toHaveTitle(text.metaTitle);
        const hrefs = await page.locator("[data-language-switcher] a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
        expect(hrefs).toEqual(LANGS.map((l) => pathFor(l, key)));
      }
    });

    test("the headline blocks do not overflow a 390 px screen and the header fits", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, lang);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // Cada título (hero, seção 2 e seção 4) cabe na largura da tela: a caixa do texto HTML é a mesma que o 3D ocupa.
      for (const stage of [["hero-s2", 0.05], ["hero-s2", 0.7], ["video2", 0.5]] as const) {
        await page.evaluate(([s, target]) => {
          const wrapper = document.querySelector<HTMLElement>(`[data-stage="${s}"]`)!;
          const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
          window.scrollTo(0, wrapper.getBoundingClientRect().top + window.scrollY + (target as number) * (wrapper.offsetHeight - sticky.offsetHeight));
        }, stage);
        await page.waitForTimeout(500);
      }
      const titles = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-title]")].map((el) => ({ name: el.dataset.title, width: el.getBoundingClientRect().width, vw: window.innerWidth })),
      );
      expect(titles.length).toBeGreaterThanOrEqual(3);
      for (const t of titles) expect(t.width, `title ${t.name} is ${t.width}px wide on a ${t.vw}px screen`).toBeLessThanOrEqual(t.vw);
      const header = await page.evaluate(() => {
        const h = document.querySelector("header")!;
        const box = (el: Element) => el.getBoundingClientRect();
        const switcher = h.querySelector("[data-language-switcher] button")!;
        const cta = h.querySelector("a.bg-teal")!;
        return { switcherVisible: box(switcher).width > 0, ctaRight: box(cta).right, vw: window.innerWidth, overlap: box(switcher).right > box(cta).left + 1 };
      });
      expect(header.switcherVisible).toBe(true);
      expect(header.ctaRight, "CTA must end inside the viewport").toBeLessThanOrEqual(header.vw);
      expect(header.overlap, "switcher and CTA must not overlap").toBe(false);
    });

    test("no layout shift on load", async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { hadRecentInput: boolean; value: number }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await open(page, lang);
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.02);
    });
  });
}

test.describe("language switcher", () => {
  test("opens by keyboard, closes with Escape and returns the focus", async ({ page }) => {
    await open(page, "pt");
    const button = page.locator("[data-language-switcher] button");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "true");
  });

  test("choosing English from the Portuguese home lands on /en with the English headline", async ({ page }) => {
    await open(page, "pt");
    await page.locator("[data-language-switcher] button").click();
    await page.locator('[data-language-switcher] a[hreflang="en"]').click();
    await page.waitForURL("**/en");
    expect((await page.locator("h1").first().textContent())?.replace(/\s+/g, " ").trim()).toBe(getCopy("en").hero.title.replace(/\n/g, " "));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("on a legal page it goes to the same page in the other language", async ({ page }) => {
    await page.goto("/en/privacy");
    await page.locator("[data-language-switcher] button").click();
    await page.locator('[data-language-switcher] a[hreflang="es"]').click();
    await page.waitForURL("**/es/privacidad");
    await expect(page.locator("h1")).toHaveText(getLegal("es").privacy.title);
  });

  test("axe finds no serious violation with the list open", async ({ page }) => {
    await open(page, "es");
    await page.locator("[data-language-switcher] button").click();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
    expect(serious).toEqual([]);
  });

  test("sitemap.xml lists every language with alternates", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const path of ["", "/privacidade", "/termos", "/en", "/en/privacy", "/en/terms", "/es", "/es/privacidad", "/es/terminos"]) expect(xml).toContain(`<loc>https://dynamo.business${path}</loc>`);
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain('hreflang="x-default"');
  });

  test("an unknown language path is a 404", async ({ request }) => {
    expect((await request.get("/fr")).status()).toBe(404);
  });
});
