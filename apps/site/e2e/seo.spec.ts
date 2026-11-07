import { expect, test } from "@playwright/test";

test("page metadata: title, description, canonical base, Open Graph and Twitter card", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Dynamo/);
  const meta = (selector: string) => page.locator(selector).getAttribute("content");
  expect(await meta('meta[name="description"]')).toMatch(/marketing/i);
  expect(await meta('meta[property="og:title"]')).toMatch(/Dynamo/);
  expect(await meta('meta[property="og:locale"]')).toBe("pt_BR");
  expect(await meta('meta[property="og:image"]')).toMatch(/\/og\.png$/);
  expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
  expect(await page.locator("html").getAttribute("lang")).toBe("pt-BR");
});

test("structured data describes the organization", async ({ page }) => {
  await page.goto("/");
  const json = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(json!);
  expect(data["@type"]).toBe("Organization");
  expect(data.name).toMatch(/Dynamo/);
  expect(data.url).toBe("https://dynamo.business");
});

test("sitemap.xml and robots.txt are served and point at the site", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  for (const path of ["https://dynamo.business", "https://dynamo.business/privacidade", "https://dynamo.business/termos"]) expect(xml).toContain(path);
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toMatch(/Sitemap: https:\/\/dynamo\.business\/sitemap\.xml/);
});

test("the Open Graph image exists and is 1200x630", async ({ request }) => {
  const res = await request.get("/og.png");
  expect(res.ok()).toBe(true);
  const buffer = await res.body();
  expect(buffer.readUInt32BE(16)).toBe(1200); // largura no cabeçalho IHDR do PNG
  expect(buffer.readUInt32BE(20)).toBe(630);
});
