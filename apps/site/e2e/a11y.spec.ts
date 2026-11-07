import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__dynamo?.settle?.video2) && window.__dynamo?.progress["chat"] !== undefined);
}

async function goTo(page: Page, stage: string, p: number) {
  await page.evaluate(([s, target]) => {
    const wrapper = document.querySelector<HTMLElement>(`[data-stage="${s}"]`)!;
    const sticky = wrapper.querySelector<HTMLElement>("[data-sticky]")!;
    window.scrollTo(0, wrapper.getBoundingClientRect().top + window.scrollY + (target as number) * (wrapper.offsetHeight - sticky.offsetHeight));
  }, [stage, p] as const);
  await page.waitForFunction(([s, target]) => Math.abs((window.__dynamo?.progress[s as string] ?? -1) - (target as number)) < 0.01, [stage, p] as const);
  await page.waitForTimeout(700);
}

const serious = (results: Awaited<ReturnType<AxeBuilder["analyze"]>>) =>
  results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);

test("axe finds no serious or critical violations in the hero, the chat, the closing stage and the footer", async ({ page }) => {
  await open(page);
  const spots: Array<[string, () => Promise<void>]> = [
    ["hero", () => goTo(page, "hero-s2", 0.05)],
    ["section 2", () => goTo(page, "hero-s2", 0.7)],
    ["chat", () => goTo(page, "chat", 0.5)],
    ["closing stage", () => goTo(page, "video2", 0.92)],
    ["footer", () => page.locator("footer").scrollIntoViewIfNeeded()],
  ];
  for (const [name, go] of spots) {
    await go();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(serious(results), `violations at ${name}`).toEqual([]);
  }
});

test("there is exactly one rendered h1 and a skip link that reaches the content", async ({ page }) => {
  await open(page);
  expect(await page.locator("h1:visible, h1").count()).toBe(1);
  await page.keyboard.press("Tab");
  const first = page.locator(":focus");
  await expect(first).toHaveAttribute("href", "#top");
  await expect(first).toBeVisible();
  await expect(first).toContainText(/conteúdo/i);
});

test("keyboard: every stop from the menu to the footer shows a visible focus ring", async ({ page }) => {
  await open(page);
  const stops: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      return { tag: el.tagName, name: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 24) || el.getAttribute("name") || "", ring, hidden: el.getAttribute("tabindex") === "-1" };
    });
    if (!info) break;
    expect(info.ring, `focus ring on ${info.tag} "${info.name}"`).toBe(true);
    stops.push(info.name);
  }
  expect(stops.length).toBeGreaterThan(8);
  expect(stops.some((s) => /FALE COM A DYNAMO/i.test(s))).toBe(true); // o CTA do palco é alcançável pelo teclado
  expect(stops.some((s) => /^enviar$/i.test(s))).toBe(true); // e o formulário do footer também
});
