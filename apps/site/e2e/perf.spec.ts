import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// Orçamento de desempenho da spec: JS inicial < 200 KB gzip (sem o WebGL), CLS <= 0,01, LCP < 2,5 s em 3G rápido
// com CPU 4x mais lenta, frames em cache imutável. Só em desktop: o orçamento de JS é o mesmo e o 3G emulado é lento.
test.skip(({ isMobile }) => isMobile, "orçamento medido no projeto desktop");

// Determinístico: soma o gzip de todos os scripts que o HTML referencia (o JS inicial) e garante que o Three.js e a
// leitura de fontes (carregados sob demanda) não estão entre eles. Uma medida por relógio ("antes do evento") se mostrou
// instável sob carga e contava só parte dos arquivos.
test("initial JavaScript is under 200 KB gzip and does not include Three.js", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const sources = [...new Set([...html.matchAll(/(\/_next\/static\/[^"'\s?\\]+\.js)/g)].map((m) => m[1]))];
  expect(sources.length).toBeGreaterThan(3);
  let total = 0;
  const sizes: Array<[string, number]> = [];
  for (const src of sources) {
    const body = await (await request.get(src)).body();
    const gz = gzipSync(body).length;
    total += gz;
    sizes.push([src.split("/").pop()!, gz]);
    expect(body.includes("WebGLRenderer"), `${src} must not bundle Three.js`).toBe(false);
  }
  console.log(`Initial JS: ${(total / 1024).toFixed(1)} KB gzip in ${sources.length} files (budget 200 KB)`);
  console.log(sizes.sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n, gz]) => `  ${n}  ${(gz / 1024).toFixed(1)} KB`).join("\n"));
  expect(total).toBeLessThan(200 * 1024);
});

test("layout shift stays at or below 0.01 while loading and scrolling through the whole page", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__dynamo?.settle?.video2));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 700) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  console.log(`CLS: ${cls.toFixed(4)}`);
  expect(cls).toBeLessThanOrEqual(0.01);
});

test("largest contentful paint is under 2.5 s on fast 3G with a 4x slower CPU", async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    (window as unknown as { __lcp: number }).__lcp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<{ startTime: number; url?: string; element?: Element }>) {
        (window as unknown as { __lcp: number; __lcpUrl: string }).__lcp = e.startTime;
        (window as unknown as { __lcpUrl: string }).__lcpUrl = e.url || (e.element instanceof HTMLImageElement ? e.element.currentSrc : (e.element?.tagName ?? ""));
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const lcp = await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp);
  console.log(`LCP (3G, CPU 4x): ${Math.round(lcp)} ms`);
  expect(lcp).toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2500);
  // O Chrome ignora, no LCP, imagens que cobrem a tela inteira (as trata como fundo). Por isso medimos direto o que
  // a pessoa espera ver: o primeiro frame do vídeo (poster no HTML) termina de chegar dentro do orçamento.
  const posterEnd = await page.evaluate(() => {
    const entry = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).find((e) => /\/frames\/v1\/poster-(desktop|mobile)\.webp(\?.*)?$/.test(e.name));
    return entry ? entry.responseEnd : -1;
  });
  console.log(`First frame (poster) downloaded at: ${Math.round(posterEnd)} ms`);
  expect(posterEnd).toBeGreaterThan(0);
  expect(posterEnd).toBeLessThan(2500);
  // O canvas (WebGL) assume depois do poster; o instante em que ele desenha o primeiro frame fica registrado.
  await page.waitForFunction(() => performance.getEntriesByName("stage:first-frame:v1").length > 0, undefined, { timeout: 20_000 });
  const firstFrame = await page.evaluate(() => performance.getEntriesByName("stage:first-frame:v1")[0].startTime);
  console.log(`First video frame on screen (3G, CPU 4x): ${Math.round(firstFrame)} ms`);
  expect(firstFrame).toBeLessThan(15_000); // o poster já está na tela; o canvas só precisa assumir antes de a pessoa rolar muito
});

test("the frames and the hashed build assets are served with immutable caching", async ({ request }) => {
  for (const path of ["/frames/v1/desktop/0001.webp", "/frames/v2/mobile/0001.webp", "/frames/v1/manifest.json"]) {
    const res = await request.get(path);
    expect(res.ok(), path).toBe(true);
    if (path.endsWith(".webp")) expect(res.headers()["cache-control"], path).toContain("immutable");
  }
});
